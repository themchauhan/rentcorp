"use server";

import { changeOwnPassword, type PasswordState } from "@/lib/auth/change-password";
import { requireActiveTenant } from "@/lib/auth/guards";

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await requireActiveTenant();
  return changeOwnPassword(profile, formData);
}
