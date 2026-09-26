"use server";

import { changeOwnPassword, type PasswordState } from "@/lib/auth/change-password";
import { requireTenantMember } from "@/lib/auth/guards";

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await requireTenantMember();
  return changeOwnPassword(profile, formData);
}
