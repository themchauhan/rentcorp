import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { daysOverdue, effectiveStatus } from "@/lib/booking-status";
import { amountDueForStoredBooking } from "@/lib/bookings";
import { formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import {
  istDayBounds,
  resolveRange,
  summarizeCollections,
  summarizeDiscounts,
} from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CARD: "Card", OTHER: "Other" } as const;
const card = "rounded-2xl border border-stone-200 bg-white p-4";

const ORDER_FIELDS = `id, booking_number, status, event_start_date, expected_return_date,
  discount_type, discount_value, discount_updated_by, discount_updated_at,
  customer:rental_customers (name),
  lines:rental_order_items (id, quantity, rate_paise_snapshot, rate_unit_snapshot),
  returns:rental_returns (rental_order_item_id, quantity_returned, returned_on),
  payments:rental_payments (amount_paise)`;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireTenantAdmin({ write: false });
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = todayIST();
  const range = resolveRange(one(sp.from), one(sp.to), today);
  const todayBounds = istDayBounds(today, today);
  const rangeBounds = istDayBounds(range.from, range.to);

  const supabase = await createClient();
  const [openRes, todayPayRes, rangePayRes, discountRes, peopleRes] = await Promise.all([
    supabase
      .from("rental_orders")
      .select(ORDER_FIELDS)
      .in("status", ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"])
      .lte("event_start_date", today)
      .order("expected_return_date"),
    supabase
      .from("rental_payments")
      .select("amount_paise, mode, received_by, kind")
      .gte("received_at", todayBounds.gte)
      .lt("received_at", todayBounds.lt),
    supabase
      .from("rental_payments")
      .select("amount_paise, mode, received_by, kind")
      .gte("received_at", rangeBounds.gte)
      .lt("received_at", rangeBounds.lt),
    supabase
      .from("rental_orders")
      .select(ORDER_FIELDS)
      .neq("discount_type", "NONE")
      .neq("status", "CANCELLED")
      .gte("discount_updated_at", rangeBounds.gte)
      .lt("discount_updated_at", rangeBounds.lt),
    supabase.from("profiles").select("id, name"),
  ]);
  for (const r of [openRes, todayPayRes, rangePayRes, discountRes]) {
    if (r.error) throw new Error("Couldn't load reports");
  }
  const names = new Map((peopleRes.data ?? []).map((p) => [p.id, p.name]));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "Former staff") : "Unknown");

  const open = (openRes.data ?? []).map((o) => ({
    o,
    status: effectiveStatus(o.status, o.expected_return_date, today),
    late: daysOverdue(o.expected_return_date, today),
    due: amountDueForStoredBooking(o, today).amountDue,
  }));
  const overdue = open.filter((r) => r.late > 0).sort((a, b) => b.late - a.late || b.due - a.due);
  const notLate = open.filter((r) => r.late === 0);
  const todayCollections = summarizeCollections(todayPayRes.data ?? []);
  const rangeCollections = summarizeCollections(rangePayRes.data ?? []);
  const discounts = summarizeDiscounts(
    (discountRes.data ?? []).map((o) => ({
      updatedBy: o.discount_updated_by,
      amount: amountDueForStoredBooking(o, today).discount,
    })),
  );

  const Row = ({ r }: { r: (typeof open)[number] }) => (
    <li>
      <Link href={`/bookings/${r.o.id}`} className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {r.o.customer?.name} <span className="text-stone-500">#{r.o.booking_number}</span>
          </span>
          <span className="text-xs text-stone-500">
            {r.late > 0 ? (
              <span className="font-semibold text-red-700">
                {r.late} day{r.late === 1 ? "" : "s"} overdue
              </span>
            ) : (
              `Back by ${formatDate(r.o.expected_return_date)}`
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge status={r.status} />
          <span className="font-semibold">{formatRupees(r.due)}</span>
        </span>
      </Link>
    </li>
  );

  return (
    <section className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-stone-900">Reports</h1>

      {/* ------------------------------------------------ Today */}
      <div className={card} data-testid="report-today">
        <h2 className="text-sm font-medium text-stone-500">
          Collected today · {formatDate(today)}
        </h2>
        <p className="text-3xl font-bold" data-testid="collected-today">
          {formatRupees(todayCollections.total)}
        </p>
        <p className="text-sm text-stone-600">
          {todayCollections.count} payment{todayCollections.count === 1 ? "" : "s"}
          {todayCollections.reversals ? ` · ${todayCollections.reversals} reversal` : ""}
        </p>
        {todayCollections.byMode.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-2">
            <div>
              <h3 className="mb-1 font-medium">By mode</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3" data-testid="today-by-mode">
                {todayCollections.byMode.map((m) => (
                  <div key={m.mode} className="contents">
                    <dt>{MODE_LABEL[m.mode]}</dt>
                    <dd className="text-right">{formatRupees(m.amount)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="mb-1 font-medium">By staff</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3" data-testid="today-by-staff">
                {todayCollections.byStaff.map((s) => (
                  <div key={s.userId ?? "none"} className="contents">
                    <dt className="truncate">{nameOf(s.userId)}</dt>
                    <dd className="text-right">{formatRupees(s.amount)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ Overdue */}
      <div className={card} data-testid="report-overdue">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Overdue ({overdue.length})</h2>
          <span className="font-semibold text-red-700">
            {formatRupees(overdue.reduce((s, r) => s + r.due, 0))}
          </span>
        </div>
        {overdue.length ? (
          <ul className="mt-2 divide-y divide-stone-100">
            {overdue.map((r) => (
              <Row key={r.o.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-500">Nothing overdue.</p>
        )}
      </div>

      {/* ------------------------------------------------ Open */}
      <div className={card} data-testid="report-open">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Out now, on time ({notLate.length})</h2>
          <span className="font-semibold">
            {formatRupees(notLate.reduce((s, r) => s + r.due, 0))}
          </span>
        </div>
        {notLate.length ? (
          <ul className="mt-2 divide-y divide-stone-100">
            {notLate.map((r) => (
              <Row key={r.o.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No other bookings out.</p>
        )}
      </div>

      {/* ------------------------------------------------ Range */}
      <div className={card} data-testid="report-range">
        <h2 className="mb-3 text-lg font-semibold">Collections and discounts</h2>
        <form action="/reports" className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={today}
              className="mt-1 block min-h-11 rounded-lg border border-stone-300 px-2 text-base"
            />
          </label>
          <label className="text-sm">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              max={today}
              className="mt-1 block min-h-11 rounded-lg border border-stone-300 px-2 text-base"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 font-medium"
          >
            Show
          </button>
        </form>
        <p className="mt-3 text-sm text-stone-600">
          {formatDate(range.from)} – {formatDate(range.to)}
        </p>
        <p className="text-2xl font-bold" data-testid="range-total">
          {formatRupees(rangeCollections.total)}
        </p>
        <p className="text-sm text-stone-600">
          collected in {rangeCollections.count} payment{rangeCollections.count === 1 ? "" : "s"}
        </p>
        {rangeCollections.byMode.length > 0 && (
          <dl
            className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 text-sm"
            data-testid="range-by-staff"
          >
            {rangeCollections.byMode.map((m) => (
              <div key={m.mode} className="contents">
                <dt>{MODE_LABEL[m.mode]}</dt>
                <dd className="text-right">{formatRupees(m.amount)}</dd>
              </div>
            ))}
            {rangeCollections.byStaff.map((s) => (
              <div key={s.userId ?? "none"} className="contents">
                <dt className="text-stone-600">Received by {nameOf(s.userId)}</dt>
                <dd className="text-right text-stone-600">{formatRupees(s.amount)}</dd>
              </div>
            ))}
          </dl>
        )}

        <h3 className="mt-5 font-semibold">Discounts given</h3>
        <p className="text-sm text-stone-600" data-testid="discount-total">
          {formatRupees(discounts.total)} on {discounts.count} booking
          {discounts.count === 1 ? "" : "s"}
        </p>
        {discounts.byStaff.length > 0 && (
          <dl
            className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 text-sm"
            data-testid="discounts-by-staff"
          >
            {discounts.byStaff.map((s) => (
              <div key={s.userId ?? "none"} className="contents">
                <dt>
                  {nameOf(s.userId)} ({s.count})
                </dt>
                <dd className="text-right">{formatRupees(s.amount)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
