import Link from "next/link";
import { SendPanel } from "@/components/send-panel";
import { StatusBadge } from "@/components/status-badge";
import { requireTenantMember } from "@/lib/auth/guards";
import {
  buildBookingMessages,
  loadTemplates,
  ORDER_FOR_MESSAGES,
  type OrderForMessages,
} from "@/lib/booking-messages";
import { daysOverdue, effectiveStatus } from "@/lib/booking-status";
import { amountDueForStoredBooking, estimateStoredBooking } from "@/lib/bookings";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const UPCOMING_DAYS = 3;

type Row = OrderForMessages & { id: string };

function itemsSummary(order: Row): string {
  const parts = [...order.lines]
    .sort((a, b) => b.quantity - a.quantity)
    .map((l) => `${l.quantity} ${l.item_name_snapshot}`);
  return parts.length > 2
    ? `${parts.slice(0, 2).join(", ")} +${parts.length - 2} more`
    : parts.join(", ");
}

function lastMessagedLabel(openedAt: string | undefined, today: string) {
  if (!openedAt) return { text: "Not messaged yet", today: false };
  const d = new Date(openedAt);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const time = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
  return day === today
    ? { text: `Messaged today, ${time}`, today: true }
    : { text: `Last messaged ${formatDate(day)}`, today: false };
}

export default async function HomePage() {
  const profile = await requireTenantMember();
  const today = todayIST();
  const supabase = await createClient();

  // Open bookings that are out now or start within the next few days.
  const { data, error } = await supabase
    .from("rental_orders")
    .select(ORDER_FOR_MESSAGES)
    .in("status", ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"])
    .lte("event_start_date", addDays(today, UPCOMING_DAYS))
    .order("expected_return_date")
    .limit(200);
  if (error) throw new Error("Couldn't load bookings");
  const orders = (data ?? []) as Row[];

  const outNow = orders
    .filter((o) => o.event_start_date <= today)
    .map((o) => ({
      order: o,
      overdue: daysOverdue(o.expected_return_date, today),
      due: amountDueForStoredBooking(o, today),
    }))
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        a.order.expected_return_date.localeCompare(b.order.expected_return_date),
    );
  const upcoming = orders
    .filter((o) => o.event_start_date > today)
    .sort((a, b) => a.event_start_date.localeCompare(b.event_start_date));

  // Everything back but not yet paid up.
  const { data: returnedData } = await supabase
    .from("rental_orders")
    .select(ORDER_FOR_MESSAGES)
    .eq("status", "RETURNED")
    .is("closed_at", null)
    .order("expected_return_date", { ascending: false })
    .limit(100);
  const awaitingPayment = ((returnedData ?? []) as Row[])
    .map((o) => ({ order: o, due: amountDueForStoredBooking(o, today) }))
    .filter((r) => r.due.amountDue > 0);

  const templates = await loadTemplates(supabase);
  const { data: log } = orders.length
    ? await supabase
        .from("message_log")
        .select("rental_order_id, opened_at")
        .in(
          "rental_order_id",
          orders.map((o) => o.id),
        )
        .order("opened_at", { ascending: false })
    : { data: [] };
  const lastMessaged = new Map<string, string>();
  for (const m of log ?? [])
    if (!lastMessaged.has(m.rental_order_id)) lastMessaged.set(m.rental_order_id, m.opened_at);

  const overdueCount = outNow.filter((r) => r.overdue > 0).length;
  const totalDue = outNow.reduce((s, r) => s + r.due.amountDue, 0);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Home</h1>
          <p className="text-sm text-stone-600">{formatDate(today)}</p>
        </div>
        {!profile.readOnly && (
          <Link
            href="/bookings/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            New booking
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center" data-testid="home-summary">
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <dt className="text-xs text-stone-500">Out now</dt>
          <dd className="text-xl font-bold">{outNow.length}</dd>
        </div>
        <div
          className={`rounded-xl border p-3 ${overdueCount ? "border-red-200 bg-red-50" : "border-stone-200 bg-white"}`}
        >
          <dt className="text-xs text-stone-500">Overdue</dt>
          <dd className={`text-xl font-bold ${overdueCount ? "text-red-700" : ""}`}>
            {overdueCount}
          </dd>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <dt className="text-xs text-stone-500">Due today</dt>
          <dd className="text-xl font-bold" data-testid="home-total-due">
            {formatRupees(totalDue)}
          </dd>
        </div>
      </dl>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Out now</h2>
        {outNow.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
            Nothing is out right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {outNow.map(({ order, overdue, due }) => {
              const prepared = buildBookingMessages(
                order,
                profile.tenant.name,
                templates,
                ["AMOUNT_DUE"],
                today,
              );
              const msg = prepared?.messages[0];
              const last = lastMessagedLabel(lastMessaged.get(order.id), today);
              return (
                <li
                  key={order.id}
                  className={`space-y-3 rounded-2xl border bg-white p-4 ${overdue ? "border-red-200" : "border-stone-200"}`}
                  data-testid="home-row"
                >
                  <Link href={`/bookings/${order.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-semibold">
                        <span className="block truncate">{order.customer?.name}</span>
                        <span className="text-sm font-normal text-stone-500">
                          #{order.booking_number}
                        </span>
                      </p>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatRupees(due.amountDue)}</p>
                        <p className="text-xs text-stone-500">due today</p>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-sm text-stone-600">{itemsSummary(order)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      {overdue > 0 ? (
                        <span className="font-semibold text-red-700" data-testid="overdue-label">
                          {overdue} day{overdue === 1 ? "" : "s"} overdue
                        </span>
                      ) : (
                        <span className="text-stone-600">
                          Day {due.daysSoFar} · back by {formatDate(order.expected_return_date)}
                        </span>
                      )}
                      <StatusBadge
                        status={effectiveStatus(order.status, order.expected_return_date, today)}
                      />
                    </div>
                    <p
                      className={`mt-1 text-xs ${last.today ? "font-medium text-green-700" : "text-stone-500"}`}
                      data-testid="last-messaged"
                    >
                      {last.text}
                    </p>
                  </Link>
                  {!profile.readOnly && prepared && msg && (
                    <details className="group">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center rounded-lg border border-brand-700 font-semibold text-brand-800 group-open:mb-3">
                        Send amount due
                      </summary>
                      <SendPanel
                        orderId={order.id}
                        type="AMOUNT_DUE"
                        title="Amount due message"
                        whatsappText={msg.whatsapp}
                        smsText={msg.sms}
                        mobile={prepared.recipient.mobile}
                        whatsappNumber={prepared.recipient.whatsappNumber}
                        preferredChannel={prepared.recipient.preferredChannel}
                      />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {awaitingPayment.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Returned, payment pending</h2>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {awaitingPayment.map(({ order: o, due }) => (
              <li key={o.id} data-testid="awaiting-payment-row">
                <Link
                  href={`/bookings/${o.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                >
                  <span className="min-w-0 truncate font-medium">
                    {o.customer?.name} <span className="text-stone-500">#{o.booking_number}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold">{formatRupees(due.amountDue)}</span>
                    <span className="text-xs text-stone-500">to collect</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Starting soon</h2>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {upcoming.map((o) => (
              <li key={o.id} data-testid="upcoming-row">
                <Link
                  href={`/bookings/${o.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {o.customer?.name} <span className="text-stone-500">#{o.booking_number}</span>
                    </span>
                    <span className="block truncate text-sm text-stone-600">{itemsSummary(o)}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-medium">{formatDate(o.event_start_date)}</span>
                    <span className="text-xs text-stone-500">
                      {formatRupees(estimateStoredBooking(o).total)} planned
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
