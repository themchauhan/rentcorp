import "server-only";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "./session";

export type PasswordState = {
  error?: string;
  success?: string;
  fieldErrors?: { current?: string; next?: string; confirm?: string };
};

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, {
    path: ["next"],
    message: "New password must be different",
  });

/**
 * Changes the signed-in user's own password after re-checking the current
 * one, clears any "must change password" flag, and audit-logs it. The
 * caller must already have run the appropriate guard.
 */
export async function changeOwnPassword(
  profile: SessionProfile,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const e = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { current: e.current?.[0], next: e.next?.[0], confirm: e.confirm?.[0] } };
  }
  if (!profile.loginEmail) return { error: "Couldn't verify your account. Log in again." };

  const supabase = await createClient();
  // Re-check the current password before allowing a change.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: profile.loginEmail,
    password: parsed.data.current,
  });
  if (authError) {
    if (authError.code === "invalid_credentials") {
      return { fieldErrors: { current: "Current password is wrong" } };
    }
    if (authError.code === "over_request_rate_limit" || authError.status === 429) {
      return { error: "Too many attempts. Wait a few minutes and try again." };
    }
    return { error: "Couldn't verify your password right now. Please try again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) return { error: "Couldn't change your password. Please try again." };

  if (profile.kind === "tenant") {
    const { error: flagError } = await supabase.rpc("mark_password_changed");
    if (flagError) return { error: "Password changed, but please log in again." };
  }

  await logAudit(
    "auth.password_changed",
    "user",
    profile.userId,
    { was_temporary: profile.kind === "tenant" && profile.mustChangePassword },
    { client: supabase },
  );
  return { success: "Password changed." };
}
