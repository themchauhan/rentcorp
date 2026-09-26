"use server";

import { redirect } from "next/navigation";
import { changeOwnPassword, type PasswordState } from "@/lib/auth/change-password";
import { requireActiveTenant } from "@/lib/auth/guards";

export async function changeTemporaryPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await requireActiveTenant({ allowTemporaryPassword: true });
  const result = await changeOwnPassword(profile, formData);
  if (result.success) redirect("/");
  return result;
}
