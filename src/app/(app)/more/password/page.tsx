import type { Metadata } from "next";
import { changePassword } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <section className="max-w-sm">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Change password</h1>
      <PasswordForm action={changePassword} />
    </section>
  );
}
