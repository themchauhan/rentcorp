import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { tenantAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/guards";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { addMonths, istDateOf } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { ResetOwnerButton } from "../../reset-owner-button";
import {
  DeleteTestBusinessForm,
  ExtendButtons,
  SubscriptionForm,
  SubscriptionPaymentForm,
  TestFlagForm,
  WhatsAppAddonForm,
  WhatsAppConnectionForm,
} from "./forms";

export const metadata: Metadata = { title: "Business" };

const METHOD_LABEL = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  OTHER: "Other",
} as const;
const card = "rounded-2xl border border-stone-200 bg-white p-4";

export default async function TenantAdminPage({ params }: PageProps<"/admin/tenants/[id]">) {
  await requireRole("SUPER_ADMIN");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tenants")
    .select(
      "id, name, phone, status, plan, is_test, whatsapp_addon, trial_ends_at, subscription_ends_at, created_at, owners:profiles (id, name, mobile, role, status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const { data: payments } = await supabase
    .from("subscription_payments")
    .select(
      "id, amount_paise, payment_date, payment_method, reference_number, period_start, period_end, notes",
    )
    .eq("tenant_id", id)
    .order("payment_date", { ascending: false });

  const { data: whatsapp } = await supabase
    .from("whatsapp_connections")
    .select("waba_id, phone_number_id, display_phone_number, status")
    .eq("tenant_id", id)
    .maybeSingle();

  const today = todayIST();
  const access = tenantAccess(t);
  const subEnd = istDateOf(t.subscription_ends_at);
  const nextStart = subEnd && subEnd >= today ? addDays(subEnd, 1) : today;
  const owners = t.owners.filter((p) => p.role === "ADMIN");

  return (
    <section className="space-y-5">
      <Link href="/admin" className="text-sm font-medium text-brand-700">
        ← Businesses
      </Link>
      <div>
        <h1 className="text-2xl font-bold">
          {t.name}
          {t.is_test && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 align-middle text-xs font-semibold text-purple-800">
              TEST
            </span>
          )}
        </h1>
        <p
          className={`mt-1 text-sm font-medium ${access.ok ? "text-green-700" : "text-red-700"}`}
          data-testid="tenant-access"
        >
          {access.ok ? "Has access" : "Read-only — no access"} · {t.status} · plan {t.plan ?? "—"}
        </p>
        <p className="text-sm text-stone-600">
          {t.status === "TRIAL" && t.trial_ends_at
            ? `Trial ends ${formatDate(istDateOf(t.trial_ends_at)!)}`
            : subEnd
              ? `Subscription ends ${formatDate(subEnd)}`
              : "No end date"}
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Extend</h2>
        <ExtendButtons tenantId={t.id} />
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Record a subscription payment</h2>
        <SubscriptionPaymentForm
          tenantId={t.id}
          today={today}
          periodStart={nextStart}
          periodEnd={addDays(addMonths(nextStart, 1), -1)}
        />
      </div>

      <div className={card} data-testid="subscription-payments">
        <h2 className="mb-2 font-semibold">Subscription payments</h2>
        {payments?.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2">
                <span className="font-semibold">{formatRupees(p.amount_paise)}</span> ·{" "}
                {METHOD_LABEL[p.payment_method]} · {formatDate(p.payment_date)}
                <span className="block text-xs text-stone-500">
                  For {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  {p.reference_number ? ` · ref ${p.reference_number}` : ""}
                  {p.notes ? ` · ${p.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">None recorded.</p>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Status, plan and dates</h2>
        <SubscriptionForm
          tenantId={t.id}
          status={t.status}
          plan={t.plan ?? ""}
          trialEnds={istDateOf(t.trial_ends_at) ?? ""}
          subscriptionEnds={subEnd ?? ""}
        />
        <p className="mt-2 text-xs text-stone-500">
          Suspended, expired or past its end date = read-only for the business. Nothing is deleted.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold">Owner</h2>
        {owners.map((o) => (
          <div key={o.id} className="space-y-2">
            <p className="text-sm">
              {o.name} · <span className="font-mono">{o.mobile}</span>
              {o.status === "INACTIVE" ? " (deactivated)" : ""}
            </p>
            <ResetOwnerButton profileId={o.id} />
          </div>
        ))}
      </div>
      <div className={card}>
        <h2 className="mb-1 font-semibold">WhatsApp automation (add-on)</h2>
        <p className="mb-3 text-sm text-stone-600">
          Optional extra. Steps for you and the client: docs/whatsapp/client-onboarding.md.
        </p>
        <WhatsAppAddonForm tenantId={t.id} on={t.whatsapp_addon} />
        {t.whatsapp_addon && (
          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="mb-3 text-sm text-stone-600">
              The business’s own WhatsApp Business number, from Meta’s WhatsApp Manager.
            </p>
            <WhatsAppConnectionForm tenantId={t.id} connection={whatsapp} />
          </div>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Test business</h2>
        <TestFlagForm tenantId={t.id} isTest={t.is_test} />
      </div>

      {t.is_test && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <h2 className="mb-3 font-semibold text-red-900">Delete test business</h2>
          <DeleteTestBusinessForm tenantId={t.id} name={t.name} />
        </div>
      )}
    </section>
  );
}
