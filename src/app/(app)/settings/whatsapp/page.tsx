import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { WhatsAppConnectionForm } from "@/components/whatsapp-connection-form";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ownerDisconnect, ownerSaveConnection, ownerTestMessage } from "./actions";
import { AutomationForm } from "./automation-form";
import { EmbeddedSignupButton } from "./embedded-signup";

export const metadata: Metadata = { title: "WhatsApp" };

const card = "rounded-2xl border border-stone-200 bg-white p-4";
const STATUS = {
  PENDING: "Sending…",
  SENT: "Sent",
  DELIVERED: "Delivered",
  READ: "Read",
  FAILED: "Failed",
} as const;
const TYPE = {
  BOOKING_CONFIRMATION: "Booking details",
  AMOUNT_DUE: "Amount due",
  RETURN_CONFIRMATION: "Final bill",
  RENT_DUE: "Rent due",
  PAYMENT_RECEIPT: "Payment receipt",
  AGREEMENT_RENEWAL: "Agreement renewal",
} as const;

export default async function WhatsAppSettingsPage() {
  const owner = await requireTenantAdmin({ write: false, type: "TENT_HOUSE" });
  if (!owner.tenant.whatsapp_addon) {
    return (
      <section className="max-w-2xl space-y-4">
        <div>
          <BackLink href="/settings" label="Settings" />
          <h1 className="text-2xl font-bold text-stone-900">WhatsApp</h1>
        </div>
        <div
          className="rounded-2xl border border-stone-200 bg-white p-4"
          data-testid="whatsapp-addon-off"
        >
          <p className="font-medium text-stone-900">
            Automatic WhatsApp isn’t switched on for your business.
          </p>
          <p className="mt-1 text-sm text-stone-600">
            You can keep sending every message with the one-tap Send on WhatsApp / SMS buttons. If
            you want messages sent automatically from your own WhatsApp Business number, ask
            RentCorp to switch on the add-on.
          </p>
        </div>
      </section>
    );
  }
  const supabase = await createClient();
  const [{ data: connection }, { data: settings }, { data: recent }] = await Promise.all([
    supabase
      .from("whatsapp_connections")
      .select("waba_id, phone_number_id, display_phone_number, status")
      .maybeSingle(),
    supabase
      .from("whatsapp_settings")
      .select("auto_booking_details, evening_reminder")
      .maybeSingle(),
    supabase
      .from("message_log")
      .select("id, message_type, delivery_status, opened_at, to_number, reminder_date")
      .eq("channel", "WHATSAPP_API")
      .order("opened_at", { ascending: false })
      .limit(10),
  ]);
  const connected = connection?.status === "CONNECTED";
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-2xl font-bold text-stone-900">WhatsApp</h1>
        <p className="mt-1 text-stone-600">
          Connect your own WhatsApp Business number so RentCorp can send booking details and the
          evening balance for you. Without it, the one-tap Send on WhatsApp / SMS buttons keep
          working as before.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">1. Connect your number</h2>
        {appId && configId ? (
          <EmbeddedSignupButton
            appId={appId}
            configId={configId}
            graphVersion={process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0"}
          />
        ) : (
          <p
            className="mb-4 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600"
            data-testid="signup-unavailable"
          >
            One-click “Connect with Meta” is coming soon. For now, fill in the details from Meta
            below, or ask RentCorp support to connect it for you.
          </p>
        )}
        <details className="mt-4" open={!appId || !configId}>
          <summary className="cursor-pointer font-medium text-brand-700">
            Enter details from Meta yourself
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-stone-600">
              In Meta Business (business.facebook.com) → WhatsApp Manager → API Setup you’ll find
              the Phone number ID and WhatsApp Business Account ID. Create a permanent access token
              under Business Settings → System users.
            </p>
            <WhatsAppConnectionForm
              connection={connection}
              save={ownerSaveConnection}
              disconnect={ownerDisconnect}
              test={ownerTestMessage}
            />
          </div>
        </details>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">2. What to send automatically</h2>
        {!connected && <p className="mb-3 text-sm text-stone-500">Connect your number first.</p>}
        <AutomationForm
          autoBookingDetails={settings?.auto_booking_details ?? true}
          eveningReminder={settings?.evening_reminder ?? true}
          disabled={!connected || owner.readOnly}
        />
        <p className="mt-3 text-xs text-stone-500">
          Only customers who agreed to WhatsApp messages get them. Each booking gets at most one
          evening message a day.
        </p>
      </div>

      <div className={card} data-testid="whatsapp-activity">
        <h2 className="mb-2 text-lg font-semibold">Recent automatic messages</h2>
        {recent?.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {TYPE[m.message_type]}
                  {m.reminder_date ? " · 9 PM" : ""} · {m.to_number}
                </span>
                <span className="text-xs text-stone-500">
                  {m.delivery_status ? STATUS[m.delivery_status] : ""} ·{" "}
                  {new Date(m.opened_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">None yet.</p>
        )}
      </div>
    </section>
  );
}
