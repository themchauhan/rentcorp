import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { changePassword } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <section className="max-w-sm">
      <BackLink href="/more" label="More" />
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Change password</h1>
      <PasswordForm action={changePassword} />
    </section>
  );
}
