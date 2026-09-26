import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homePathForRole } from "@/lib/auth/access";
import { getSessionProfile } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile && (profile.kind === "platform" || profile.status === "ACTIVE")) {
    redirect(homePathForRole(profile.role));
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-xl font-bold">Log in</h1>
      <LoginForm />
    </section>
  );
}
