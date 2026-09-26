import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/app/(app)/more/password/password-form";
import { requireTenantMember } from "@/lib/auth/guards";
import { changeTemporaryPassword } from "./actions";

export const metadata: Metadata = { title: "Choose your password" };
export const dynamic = "force-dynamic";

export default async function ChangeTemporaryPasswordPage() {
  const profile = await requireTenantMember({ allowTemporaryPassword: true });
  if (!profile.mustChangePassword) redirect("/");

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Choose your own password</h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">
        Hi {profile.name}, you logged in with a temporary password. Set a new one only you know.
      </p>
      <PasswordForm
        action={changeTemporaryPassword}
        currentLabel="Temporary password"
        submitLabel="Save and continue"
      />
    </section>
  );
}
