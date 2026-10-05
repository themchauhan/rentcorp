import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business settings" };

const linkClass =
  "flex min-h-12 items-center justify-between rounded-lg border border-stone-300 bg-white px-4 font-medium text-stone-700 hover:bg-stone-100";

export default async function SettingsPage() {
  const owner = await requireTenantAdmin({ write: false });
  const addon = owner.tenant.whatsapp_addon;
  const { data: whatsapp } = addon
    ? await (
        await createClient()
      )
        .from("whatsapp_connections")
        .select("display_phone_number, status")
        .maybeSingle()
    : { data: null };
  return (
    <section className="max-w-lg space-y-4">
      <div>
        <BackLink href="/more" label="More" />
        <h1 className="text-2xl font-bold text-stone-900">Business settings</h1>
      </div>
      <Link href="/settings/messages" className={linkClass}>
        Message wording <span aria-hidden="true">›</span>
      </Link>
      {addon && (
        <Link href="/settings/whatsapp" className={linkClass} data-testid="settings-whatsapp">
          <span>
            WhatsApp
            <span className="block text-sm font-normal text-stone-500">
              {whatsapp?.status === "CONNECTED"
                ? `Connected: ${whatsapp.display_phone_number}`
                : "Not connected"}
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      <Link href="/team" className={linkClass}>
        Team <span aria-hidden="true">›</span>
      </Link>
    </section>
  );
}
