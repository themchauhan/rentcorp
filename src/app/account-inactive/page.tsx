import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { tenantAccess } from "@/lib/auth/access";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account inactive" };
export const dynamic = "force-dynamic";

export default async function AccountInactivePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.kind === "platform") redirect("/admin");

  let message = "Your account has been deactivated. Contact your business owner.";
  if (profile.status === "ACTIVE" && profile.tenant) {
    const access = tenantAccess(profile.tenant);
    if (access.ok) redirect("/");
    message =
      access.reason === "SUSPENDED"
        ? `${profile.tenant.name}'s account is suspended. Please contact support.`
        : `${profile.tenant.name}'s subscription has ended. Please contact support to renew.`;
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Account inactive</h1>
      <p className="mt-2 text-stone-600">{message}</p>
      <p className="mt-1 text-sm text-stone-500">Your data is safe and has not been deleted.</p>
      <div className="mt-6">
        <SignOutButton className="text-center" />
      </div>
    </main>
  );
}
