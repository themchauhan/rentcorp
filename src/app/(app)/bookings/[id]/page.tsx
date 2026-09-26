import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Collapsible as Section } from "@/components/collapsible";
import { SendPanel } from "@/components/send-panel";
import { StatusBadge } from "@/components/status-badge";
import { FormMessage } from "@/components/ui/form";
import { requireActiveTenant } from "@/lib/auth/guards";
import { buildBookingMessages, loadTemplates } from "@/lib/booking-messages";
import { daysOverdue, effectiveStatus } from "@/lib/booking-status";
import { amountDueForStoredBooking, estimateStoredBooking } from "@/lib/bookings";
import { formatDate, formatTime, todayIST } from "@/lib/dates";
import { RATE_UNIT_LABEL } from "@/lib/items";
import type { MessageType } from "@/lib/messages";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import { formatBasisPoints } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import {
  CancelForm,
  CloseForm,
  DiscountForm,
  PaymentForm,
  ReturnForm,
  ReverseForm,
} from "./lifecycle-forms";

export const metadata: Metadata = { title: "Booking" };

const MESSAGE_LABEL = {
  BOOKING_CONFIRMATION: "Booking details",
  AMOUNT_DUE: "Amount due",
  RETURN_CONFIRMATION: "Final bill",
} as const;
const CHANNEL_LABEL = {
  WHATSAPP: "opened in WhatsApp",
  SMS: "opened in SMS",
  COPY: "copied",
} as const;
const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CARD: "Card", OTHER: "Other" } as const;

const card = "rounded-2xl border border-stone-200 bg-white p-4";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const createdParam = (await searchParams).created === "1";
  if (!z.uuid().safeParse(id).success) notFound();

  const profile = await requireActiveTenant();
  const isOwner = profile.role === "ADMIN";
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("rental_orders")
    .select(
      `id, booking_number, status, order_date, event_start_date, event_start_time,
       expected_return_date, security_deposit_paise, discount_type, discount_value,
       discount_reason, discount_updated_by, discount_updated_at, notes,
       closed_at, closed_by, cancelled_at, cancelled_by, cancel_reason,
       customer:rental_customers (id, name, mobile, whatsapp_number, preferred_channel),
       lines:rental_order_items (id, quantity, item_name_snapshot, unit_label_snapshot,
         rate_paise_snapshot, rate_unit_snapshot),
       returns:rental_returns (id, rental_order_item_id, quantity_returned, returned_on,
         condition_notes, recorded_by, recorded_at),
       payments:rental_payments (id, kind, amount_paise, mode, reverses_payment_id,
         received_by, received_at, note)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!order || !order.customer) notFound();

  const today = todayIST();
  const lines = [...order.lines].sort((a, b) =>
    a.item_name_snapshot.localeCompare(b.item_name_snapshot),
  );
  const stored = { ...order, lines };
  const estimate = estimateStoredBooking(stored);
  const due = amountDueForStoredBooking(stored, today);
  const status = effectiveStatus(order.status, order.expected_return_date, today);
  const cancelled = order.status === "CANCELLED";
  const closed = order.closed_at !== null;
  const editable = !cancelled && !closed;
  const allBack = order.status === "RETURNED";
  const overdue = daysOverdue(order.expected_return_date, today);
  const customer = order.customer;
  // "?created=1" only means "just saved" until anything else happens.
  const created = createdParam && order.returns.length === 0 && order.payments.length === 0;

  const returnedByLine = new Map<string, number>();
  for (const r of order.returns) {
    returnedByLine.set(
      r.rental_order_item_id,
      (returnedByLine.get(r.rental_order_item_id) ?? 0) + r.quantity_returned,
    );
  }
  const outLines = lines
    .map((l) => ({
      id: l.id,
      name: l.item_name_snapshot,
      unit: l.unit_label_snapshot,
      out: l.quantity - (returnedByLine.get(l.id) ?? 0),
    }))
    .filter((l) => l.out > 0);
  const reversed = new Set(order.payments.map((p) => p.reverses_payment_id).filter(Boolean));
  const payments = [...order.payments].sort((a, b) => b.received_at.localeCompare(a.received_at));
  const returns = [...order.returns].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  // Messages
  // The most relevant message first: booking details right after saving,
  // the final bill once everything is back, otherwise the amount due.
  const types: MessageType[] = cancelled
    ? []
    : allBack
      ? ["RETURN_CONFIRMATION", "BOOKING_CONFIRMATION"]
      : created
        ? due.started
          ? ["BOOKING_CONFIRMATION", "AMOUNT_DUE"]
          : ["BOOKING_CONFIRMATION"]
        : due.started
          ? ["AMOUNT_DUE", "BOOKING_CONFIRMATION"]
          : ["BOOKING_CONFIRMATION"];
  const prepared = types.length
    ? buildBookingMessages(stored, profile.tenant.name, await loadTemplates(supabase), types, today)
    : null;

  const { data: log } = await supabase
    .from("message_log")
    .select("id, message_type, channel, opened_at, sent_by")
    .eq("rental_order_id", order.id)
    .order("opened_at", { ascending: false })
    .limit(20);

  // Names for everyone who touched this booking.
  const userIds = [
    ...new Set(
      [
        ...(log ?? []).map((l) => l.sent_by),
        ...order.returns.map((r) => r.recorded_by),
        ...order.payments.map((p) => p.received_by),
        order.discount_updated_by,
        order.closed_by,
        order.cancelled_by,
      ].filter((x): x is string => !!x),
    ),
  ];
  const { data: people } = userIds.length
    ? await supabase.from("profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));
  const nameOf = (uid: string | null) => (uid ? (names.get(uid) ?? "Former staff") : "");

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <Link href="/bookings" className="text-sm font-medium text-brand-700">
          ← Bookings
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-900">Booking #{order.booking_number}</h1>
          {closed ? (
            <span
              className="rounded-full bg-stone-800 px-2 py-0.5 text-xs font-medium text-white"
              data-testid="closed-badge"
            >
              Closed
            </span>
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
      </div>

      {created && <FormMessage tone="success">Booking saved.</FormMessage>}
      {cancelled && (
        <div
          className="rounded-2xl border border-stone-300 bg-stone-100 p-4 text-sm"
          data-testid="cancelled-banner"
        >
          <p className="font-semibold">Cancelled</p>
          <p>
            {order.cancel_reason} · {nameOf(order.cancelled_by)}
            {order.cancelled_at ? `, ${fmtTime(order.cancelled_at)}` : ""}
          </p>
        </div>
      )}
      {closed && order.closed_at && (
        <p className="text-sm text-stone-600">
          Closed by {nameOf(order.closed_by)} on {fmtTime(order.closed_at)}. Nothing can be changed.
        </p>
      )}

      {/* ------------------------------------------------ Money */}
      {!cancelled && (
        <div
          className="rounded-2xl border border-brand-100 bg-brand-50 p-4"
          data-testid="amount-due-card"
        >
          {!due.started ? (
            <>
              <p className="text-sm text-stone-600">Amount due today</p>
              <p className="text-3xl font-bold" data-testid="amount-due">
                {formatRupees(due.amountDue)}
              </p>
              <p className="text-sm text-stone-600">
                Starts on {formatDate(order.event_start_date)}. Nothing is due yet.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                {allBack ? "Balance to collect" : `Amount due today · ${formatDate(today)}`}
              </p>
              <p className="text-3xl font-bold" data-testid="amount-due">
                {formatRupees(due.amountDue)}
              </p>
              {!allBack && (
                <p className="text-sm text-stone-600" data-testid="days-so-far">
                  Day {due.daysSoFar} of {estimate.days} planned
                  {overdue > 0 ? ` · ${overdue} day${overdue === 1 ? "" : "s"} overdue` : ""}
                </p>
              )}
            </>
          )}
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt>{allBack ? "Final charges" : "Charges so far"}</dt>
            <dd className="text-right" data-testid="charges">
              {formatRupees(due.gross)}
            </dd>
            {due.discount > 0 && (
              <>
                <dt>Discount</dt>
                <dd className="text-right">−{formatRupees(due.discount)}</dd>
              </>
            )}
            <dt>Paid</dt>
            <dd className="text-right" data-testid="paid">
              {due.paid > 0 ? `−${formatRupees(due.paid)}` : formatRupees(due.paid)}
            </dd>
            {due.credit > 0 && (
              <>
                <dt className="font-medium text-green-800">Customer credit</dt>
                <dd className="text-right font-medium text-green-800" data-testid="credit">
                  {formatRupees(due.credit)}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* ------------------------------------------------ Messages to send */}
      {prepared &&
        prepared.messages.map((m, i) => (
          <details
            key={m.type}
            open={i === 0 && (created || m.type !== "BOOKING_CONFIRMATION")}
            className="group rounded-2xl"
            data-testid={`send-${m.type}`}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 font-semibold group-open:hidden">
              Send {MESSAGE_LABEL[m.type].toLowerCase()} <span aria-hidden="true">›</span>
            </summary>
            <SendPanel
              orderId={order.id}
              type={m.type}
              title={`Send ${MESSAGE_LABEL[m.type].toLowerCase()}`}
              whatsappText={m.whatsapp}
              smsText={m.sms}
              mobile={prepared.recipient.mobile}
              whatsappNumber={prepared.recipient.whatsappNumber}
              preferredChannel={prepared.recipient.preferredChannel}
            />
          </details>
        ))}

      {/* ------------------------------------------------ Actions */}
      {editable && due.started && outLines.length > 0 && (
        <Section title="Record return" initiallyOpen={overdue > 0} testId="section-return">
          <ReturnForm
            orderId={order.id}
            lines={outLines}
            minDate={order.event_start_date}
            today={today}
          />
        </Section>
      )}
      {editable && (
        <Section
          title="Record payment"
          initiallyOpen={allBack && due.amountDue > 0}
          testId="section-payment"
        >
          <PaymentForm orderId={order.id} suggestedPaise={due.amountDue} />
        </Section>
      )}
      {editable && (
        <Section title="Discount" testId="section-discount">
          {order.discount_updated_at && order.discount_type !== "NONE" && (
            <p className="mb-3 text-sm text-stone-600">
              Set by {nameOf(order.discount_updated_by)} on {fmtTime(order.discount_updated_at)}
            </p>
          )}
          <DiscountForm
            orderId={order.id}
            initialType={order.discount_type}
            initialValue={
              order.discount_type === "FLAT"
                ? paiseToRupeesInput(order.discount_value)
                : order.discount_type === "PERCENT"
                  ? String(order.discount_value / 100)
                  : ""
            }
            initialReason={order.discount_reason ?? ""}
          />
        </Section>
      )}
      {editable && allBack && due.amountDue === 0 && (
        <div className={card} data-testid="close-section">
          <h2 className="mb-2 font-semibold">All items back and paid</h2>
          <CloseForm orderId={order.id} credit={due.credit > 0 ? formatRupees(due.credit) : null} />
        </div>
      )}
      {editable && isOwner && order.returns.length === 0 && (
        <Section title="Cancel booking" testId="section-cancel">
          <p className="mb-3 text-sm text-stone-600">
            For bookings made by mistake. Nothing is deleted; charges stop. Payments stay recorded.
          </p>
          <CancelForm orderId={order.id} />
        </Section>
      )}

      {/* ------------------------------------------------ Booking facts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <h2 className="text-sm font-medium text-stone-500">Customer</h2>
          <Link
            href={`/customers/${customer.id}`}
            className="mt-1 block font-semibold text-brand-800"
          >
            {customer.name}
          </Link>
          <p className="font-mono text-sm text-stone-600">{customer.mobile}</p>
          <p className="text-xs text-stone-500">
            Messages by {customer.preferred_channel === "WHATSAPP" ? "WhatsApp" : "SMS"}
          </p>
        </div>
        <div className={card}>
          <h2 className="text-sm font-medium text-stone-500">Dates</h2>
          <p className="mt-1 font-semibold">
            {formatDate(order.event_start_date)}
            {order.event_start_time ? `, ${formatTime(order.event_start_time)}` : ""}
          </p>
          <p className="text-sm text-stone-600">
            Return by {formatDate(order.expected_return_date)} · {estimate.days} day
            {estimate.days === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">Items · planned dates</h2>
        <table className="w-full text-sm" data-testid="booking-lines">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Rate</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lines.map((l, idx) => {
              const back = returnedByLine.get(l.id) ?? 0;
              return (
                <tr key={l.id} className="align-top" data-testid="booking-line">
                  <td className="py-2 pr-2">
                    {l.item_name_snapshot}
                    {back > 0 && (
                      <span className="block text-xs text-stone-500" data-testid="line-returned">
                        {back} of {l.quantity} back
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {l.quantity} {l.unit_label_snapshot}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {formatRupees(l.rate_paise_snapshot)}
                    <span className="block text-xs text-stone-500">
                      {RATE_UNIT_LABEL[l.rate_unit_snapshot]}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatRupees(estimate.lineAmounts[idx])}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200">
              <td colSpan={3} className="pt-2">
                Subtotal
              </td>
              <td className="pt-2 text-right">{formatRupees(estimate.gross)}</td>
            </tr>
            {order.discount_type !== "NONE" && (
              <tr>
                <td colSpan={3}>
                  Discount
                  {order.discount_type === "PERCENT"
                    ? ` (${formatBasisPoints(order.discount_value)})`
                    : ""}
                  {order.discount_reason ? ` · ${order.discount_reason}` : ""}
                </td>
                <td className="text-right">−{formatRupees(estimate.discount)}</td>
              </tr>
            )}
            <tr className="text-base font-bold">
              <td colSpan={3} className="pt-1">
                Planned total
              </td>
              <td className="pt-1 text-right" data-testid="booking-total">
                {formatRupees(estimate.total)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-stone-500">
          Rates are fixed at booking time. This estimate is for the planned dates.
        </p>
      </div>

      {(order.security_deposit_paise !== null || order.notes) && (
        <div className={`${card} space-y-2 text-sm`}>
          {order.security_deposit_paise !== null && (
            <p>
              <span className="text-stone-500">Security deposit:</span>{" "}
              {formatRupees(order.security_deposit_paise)}{" "}
              <span className="text-xs text-stone-500">
                (kept separately, not part of the bill)
              </span>
            </p>
          )}
          {order.notes && (
            <p className="whitespace-pre-wrap">
              <span className="text-stone-500">Notes:</span> {order.notes}
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------ History */}
      <div className={card} data-testid="payments-history">
        <h2 className="mb-2 text-lg font-semibold">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-500">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2" data-testid="payment-row">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span
                      className={`font-semibold ${p.kind === "REVERSAL" ? "text-red-700" : ""}`}
                    >
                      {p.kind === "REVERSAL"
                        ? `−${formatRupees(-p.amount_paise)} reversal`
                        : formatRupees(p.amount_paise)}
                    </span>{" "}
                    · {MODE_LABEL[p.mode]}
                    {reversed.has(p.id) && (
                      <span className="ml-1 text-xs text-stone-500">(reversed)</span>
                    )}
                    <span className="block text-xs text-stone-500">
                      {nameOf(p.received_by)}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </span>
                  <time className="shrink-0 text-xs text-stone-500" dateTime={p.received_at}>
                    {fmtTime(p.received_at)}
                  </time>
                </div>
                {isOwner && editable && p.kind === "PAYMENT" && !reversed.has(p.id) && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-medium text-brand-700">
                      Reverse…
                    </summary>
                    <ReverseForm paymentId={p.id} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card} data-testid="returns-history">
        <h2 className="mb-2 text-lg font-semibold">Returns</h2>
        {returns.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing returned yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {returns.map((r) => {
              const line = lines.find((l) => l.id === r.rental_order_item_id);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2"
                  data-testid="return-row"
                >
                  <span>
                    {r.quantity_returned} {line?.item_name_snapshot} · back{" "}
                    {formatDate(r.returned_on)}
                    <span className="block text-xs text-stone-500">
                      {nameOf(r.recorded_by)}
                      {r.condition_notes ? ` · ${r.condition_notes}` : ""}
                    </span>
                  </span>
                  <time className="shrink-0 text-xs text-stone-500" dateTime={r.recorded_at}>
                    {fmtTime(r.recorded_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={card} data-testid="message-log">
        <h2 className="mb-2 text-lg font-semibold">Messages</h2>
        {log?.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {log.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {MESSAGE_LABEL[m.message_type]} · {CHANNEL_LABEL[m.channel]}
                  <span className="block text-xs text-stone-500">{nameOf(m.sent_by)}</span>
                </span>
                <time className="shrink-0 text-xs text-stone-500" dateTime={m.opened_at}>
                  {fmtTime(m.opened_at)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">No messages sent yet.</p>
        )}
        <p className="mt-2 text-xs text-stone-500">
          Shows when a message was opened in WhatsApp or SMS on your phone. The app can’t confirm it
          was delivered.
        </p>
      </div>
    </section>
  );
}
