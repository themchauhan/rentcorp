import "server-only";
import { mobileToLoginEmail } from "@/lib/auth/mobile";
import { createAdminClient } from "@/lib/supabase/admin";

// Account administration through the Supabase Auth admin API. Callers must
// already have authorised the acting user (requireTenantAdmin /
// requireRole("SUPER_ADMIN")) and scoped the target to their tenant.

// Effectively permanent; lifted again on reactivation.
const BAN_DURATION = "876000h";

export type CreateAuthUserResult =
  { ok: true; userId: string } | { ok: false; reason: "mobile_taken" | "failed" };

export async function createAuthUser(
  mobile: string,
  password: string,
): Promise<CreateAuthUserResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: mobileToLoginEmail(mobile),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422) {
      return { ok: false, reason: "mobile_taken" };
    }
    console.error("createAuthUser failed:", error?.code, error?.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, userId: data.user.id };
}

/**
 * Removes an Auth user that was created moments ago but never got a
 * profile (a failed provisioning). Never use on real accounts — those are
 * deactivated, not deleted.
 */
export async function removeUnprovisionedAuthUser(userId: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) console.error("Cleanup of unprovisioned auth user failed:", userId, error.message);
}

/** Sets a new (temporary) password and flags it for change on next login. */
export async function resetPassword(userId: string, password: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("resetPassword failed:", error.message);
    return false;
  }
  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);
  if (flagError) {
    console.error("resetPassword flag update failed:", flagError.message);
    return false;
  }
  return true;
}

/** Deactivate/reactivate: profile status plus an Auth ban (blocks login and token refresh). */
export async function setAccountActive(userId: string, active: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ status: active ? "ACTIVE" : "INACTIVE" })
    .eq("id", userId);
  if (profileError) {
    console.error("setAccountActive profile update failed:", profileError.message);
    return false;
  }
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_DURATION,
  });
  if (error) {
    console.error("setAccountActive ban update failed:", error.message);
    return false;
  }
  return true;
}
