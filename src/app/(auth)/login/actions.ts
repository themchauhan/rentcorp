"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { homePathForRole } from "@/lib/auth/access";
import { mobileToLoginEmail, normalizeIndianMobile } from "@/lib/auth/mobile";
import { loadProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
  fieldErrors?: { mobile?: string; password?: string };
  mobile?: string;
};

const schema = z.object({
  mobile: z.string().trim().min(1, "Enter your mobile number"),
  password: z.string().min(1, "Enter your password"),
});

const WRONG_CREDENTIALS = "Wrong mobile number or password.";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    mobile: formData.get("mobile"),
    password: formData.get("password"),
  });
  const rawMobile = String(formData.get("mobile") ?? "");
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: { mobile: errors.mobile?.[0], password: errors.password?.[0] },
      mobile: rawMobile,
    };
  }

  const mobile = normalizeIndianMobile(parsed.data.mobile);
  if (!mobile) {
    return { fieldErrors: { mobile: "Enter a valid 10-digit mobile number" }, mobile: rawMobile };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: mobileToLoginEmail(mobile),
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (error?.code === "over_request_rate_limit" || error?.status === 429) {
      return {
        error: "Too many login attempts. Wait a few minutes and try again.",
        mobile: rawMobile,
      };
    }
    if (error && error.code !== "invalid_credentials") {
      console.error("Login failed unexpectedly:", error.code, error.message);
      return { error: "Couldn't log in right now. Please try again.", mobile: rawMobile };
    }
    return { error: WRONG_CREDENTIALS, mobile: rawMobile };
  }

  const profile = await loadProfile(supabase, data.user.id, data.user.email ?? null);

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account isn't set up yet. Contact support.", mobile: rawMobile };
  }
  if (profile.kind === "tenant" && profile.status !== "ACTIVE") {
    await supabase.auth.signOut();
    return {
      error: "This account has been deactivated. Contact your business owner.",
      mobile: rawMobile,
    };
  }

  // Blocked businesses (suspended/expired) may still sign in; the tenant
  // guard shows them the account-inactive page.
  await logAudit("auth.login", "user", profile.userId, {}, supabase);
  redirect(homePathForRole(profile.role));
}
