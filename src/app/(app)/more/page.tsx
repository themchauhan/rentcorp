import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireActiveTenant } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "More" };

const linkClass =
  "flex min-h-12 items-center rounded-lg border border-stone-300 bg-white px-4 font-medium text-stone-700 hover:bg-stone-100";

export default async function MorePage() {
  const profile = await requireActiveTenant();
  return (
    <section>
      <h1 className="text-2xl font-bold text-stone-900">More</h1>
      <p className="mt-1 text-stone-600">
        Signed in as {profile.name} ({profile.role === "ADMIN" ? "Owner" : "Staff"})
      </p>
      <div className="mt-6 space-y-3">
        {profile.role === "ADMIN" && (
          <>
            <Link href="/reports" className={linkClass}>
              Reports
            </Link>
            <Link href="/team" className={linkClass}>
              Team
            </Link>
            <Link href="/settings" className={linkClass}>
              Business settings
            </Link>
          </>
        )}
        <Link href="/more/password" className={linkClass}>
          Change password
        </Link>
        <SignOutButton />
      </div>
    </section>
  );
}
