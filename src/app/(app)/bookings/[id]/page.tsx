import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { FormMessage } from "@/components/ui/form";
import { amountDueForStoredBooking, estimateStoredBooking } from "@/lib/bookings";
import { formatDate, formatTime, todayIST } from "@/lib/dates";
import { RATE_UNIT_LABEL } from "@/lib/items";
import { formatRupees } from "@/lib/money";
import { formatBasisPoints } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("rental_orders")
    .select(
      `id, booking_number, status, order_date, event_start_date, event_start_time,
       expected_return_date, security_deposit_paise, discount_type, discount_value,
       discount_reason, notes,
       customer:rental_customers (id, name, mobile, whatsapp_number, preferred_channel),
       lines:rental_order_items (id, quantity, item_name_snapshot, unit_label_snapshot,
         rate_paise_snapshot, rate_unit_snapshot)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!order || !order.customer) notFound();

  const lines = [...order.lines].sort((a, b) =>
    a.item_name_snapshot.localeCompare(b.item_name_snapshot),
  );
  const estimate = estimateStoredBooking({ ...order, lines });
  // Calculated fresh on every load.
  const today = todayIST();
  const due = amountDueForStoredBooking({ ...order, lines }, today);
  const customer = order.customer;

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <Link href="/bookings" className="text-sm font-medium text-brand-700">
          ← Bookings
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-900">Booking #{order.booking_number}</h1>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {created && <FormMessage tone="success">Booking saved.</FormMessage>}

      <div
        className="rounded-2xl border border-brand-100 bg-brand-50 p-4"
        data-testid="amount-due-card"
      >
        {order.status === "CANCELLED" ? (
          <p className="font-semibold">This booking was cancelled.</p>
        ) : !due.started ? (
          <>
            <p className="text-sm text-stone-600">Amount due today</p>
            <p className="text-3xl font-bold" data-testid="amount-due">
              {formatRupees(0)}
            </p>
            <p className="text-sm text-stone-600">
              Starts on {formatDate(order.event_start_date)}. Nothing is due yet.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-600">Amount due today · {formatDate(today)}</p>
            <p className="text-3xl font-bold" data-testid="amount-due">
              {formatRupees(due.amountDue)}
            </p>
            <p className="text-sm text-stone-600" data-testid="days-so-far">
              Day {due.daysSoFar} of {estimate.days} planned
              {due.daysSoFar > estimate.days ? " · past the return date" : ""}
            </p>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt>Charges so far</dt>
              <dd className="text-right">{formatRupees(due.gross)}</dd>
              {due.discount > 0 && (
                <>
                  <dt>Discount</dt>
                  <dd className="text-right">−{formatRupees(due.discount)}</dd>
                </>
              )}
              <dt>Paid</dt>
              <dd className="text-right">
                {due.paid > 0 ? `−${formatRupees(due.paid)}` : formatRupees(0)}
              </dd>
              {due.credit > 0 && (
                <>
                  <dt>Customer credit</dt>
                  <dd className="text-right">{formatRupees(due.credit)}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
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
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
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

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
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
            {lines.map((l, idx) => (
              <tr key={l.id} className="align-top" data-testid="booking-line">
                <td className="py-2 pr-2">{l.item_name_snapshot}</td>
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
            ))}
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
        <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
          {order.security_deposit_paise !== null && (
            <p>
              <span className="text-stone-500">Security deposit:</span>{" "}
              {formatRupees(order.security_deposit_paise)}
            </p>
          )}
          {order.notes && (
            <p className="whitespace-pre-wrap">
              <span className="text-stone-500">Notes:</span> {order.notes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
