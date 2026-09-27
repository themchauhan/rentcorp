import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireTenantAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Business settings" };

const linkClass =
  "flex min-h-12 items-center justify-between rounded-lg border border-stone-300 bg-white px-4 font-medium text-stone-700 hover:bg-stone-100";

export default async function SettingsPage() {
  await requireTenantAdmin({ write: false });
  return (
    <section className="max-w-lg space-y-4">
      <div>
        <BackLink href="/more" label="More" />
        <h1 className="text-2xl font-bold text-stone-900">Business settings</h1>
      </div>
      <Link href="/settings/messages" className={linkClass}>
        Message wording <span aria-hidden="true">›</span>
      </Link>
      <Link href="/team" className={linkClass}>
        Team <span aria-hidden="true">›</span>
      </Link>
    </section>
  );
}
