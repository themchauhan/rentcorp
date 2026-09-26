"use server";

import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

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

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await requireActiveTenant();

  const parsed = schema.safeParse(Object.fromEntries(formData));
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

  await logAudit("auth.password_changed", "user", profile.userId, {}, supabase);
  return { success: "Password changed." };
}
