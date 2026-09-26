import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { effectiveStatus } from "@/lib/booking-status";
import { amountDueForStoredBooking, estimateStoredBooking } from "@/lib/bookings";
import { formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bookings" };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().replace(/^#/, "") || "";

  const supabase = await createClient();
  let query = supabase
    .from("rental_orders")
    .select(
      `id, booking_number, status, event_start_date, expected_return_date, discount_type, discount_value,
       customer:rental_customers!inner (name, mobile),
       lines:rental_order_items (quantity, rate_paise_snapshot, rate_unit_snapshot)`,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (/^\d{1,9}$/.test(q)) {
    query =
      q.length >= 6
        ? query.like("customer.mobile", `%${q}%`)
        : query.eq("booking_number", Number(q));
  } else if (q) {
    query = query.ilike("customer.name", `%${escapeLike(q)}%`);
  }
  const { data: orders, error } = await query;
  if (error) throw new Error("Couldn't load bookings");
  const today = todayIST();

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Bookings</h1>
        <Link
          href="/bookings/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
        >
          New booking
        </Link>
      </div>

      <form action="/bookings" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Booking #, customer name or mobile"
          aria-label="Search bookings"
          className="block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Search
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          {q ? "No bookings match." : "No bookings yet."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {orders.map((o) => (
            <li key={o.id} data-testid="booking-row">
              <Link href={`/bookings/${o.id}`} className="block px-4 py-3 hover:bg-stone-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold">
                    #{o.booking_number} · {o.customer.name}
                  </p>
                  <StatusBadge status={effectiveStatus(o.status, o.expected_return_date, today)} />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-3 text-sm text-stone-600">
                  <span>
                    {formatDate(o.event_start_date)} → {formatDate(o.expected_return_date)}
                  </span>
                  <RowAmount order={o} today={today} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RowAmount({
  order,
  today,
}: {
  order: Parameters<typeof amountDueForStoredBooking>[0];
  today: string;
}) {
  if (order.status === "CANCELLED") return <span className="text-stone-500">Cancelled</span>;
  const due = amountDueForStoredBooking(order, today);
  if (!due.started) {
    return (
      <span className="text-right">
        <span className="font-medium text-stone-900">
          {formatRupees(estimateStoredBooking(order).total)}
        </span>
        <span className="block text-xs text-stone-500">planned</span>
      </span>
    );
  }
  return (
    <span className="text-right">
      <span className="font-medium text-stone-900">{formatRupees(due.amountDue)}</span>
      <span className="block text-xs text-stone-500">due today</span>
    </span>
  );
}
