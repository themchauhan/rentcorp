import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { COMPLAINT_CATEGORY_LABEL, placeLabel, type ComplaintCategory } from "@/lib/pg";
import { loadLiveStays } from "@/lib/pg-server";
import { istDayBounds, resolveRange, summarizeCollections } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CARD: "Card", OTHER: "Other" } as const;
const card = "rounded-2xl border border-stone-200 bg-white p-4";

/** Owner reports for a hostel / PG. */
export async function PgReports({ from, to }: { from?: string; to?: string }) {
  const today = todayIST();
  const range = resolveRange(from, to, today);
  const bounds = istDayBounds(range.from, range.to);
  const supabase = await createClient();
  const [live, { data: rooms }, { data: pays, error }, { data: complaints }, { data: people }] =
    await Promise.all([
      loadLiveStays(supabase),
      supabase
        .from("pg_rooms")
        .select("id, name, floor, rent_mode, beds:pg_beds (id, active)")
        .eq("active", true)
        .order("name"),
      supabase
        .from("pg_payments")
        .select("amount_paise, mode, received_by, kind, purpose")
        .gte("received_at", bounds.gte)
        .lt("received_at", bounds.lt),
      supabase.from("pg_complaints").select("category, status"),
      supabase.from("profiles").select("id, name"),
    ]);
  if (error) throw new Error("Couldn't load reports");
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));

  const moneyIn = summarizeCollections((pays ?? []).filter((p) => p.purpose !== "REFUND"));
  const rentIn = (pays ?? [])
    .filter((p) => p.purpose === "RENT")
    .reduce((n, p) => n + p.amount_paise, 0);
  const depositIn = (pays ?? [])
    .filter((p) => p.purpose === "DEPOSIT")
    .reduce((n, p) => n + p.amount_paise, 0);
  const refunds = (pays ?? [])
    .filter((p) => p.purpose === "REFUND")
    .reduce((n, p) => n + p.amount_paise, 0);

  const dues = live
    .filter((s) => s.dues.amountDue > 0)
    .sort((a, b) => b.dues.amountDue - a.dues.amountDue);
  const totalDue = dues.reduce((n, s) => n + s.dues.amountDue, 0);
  const depositsHeld = live.reduce((n, s) => n + s.dues.depositHeld, 0);

  const occupancy = (rooms ?? []).map((r) => {
    const beds = r.beds.filter((b) => b.active).length;
    const places = r.rent_mode === "PER_ROOM" ? 1 : beds;
    const taken = live.filter((s) => s.stay.room?.id === r.id).length;
    return { r, places, taken };
  });
  const places = occupancy.reduce((n, o) => n + o.places, 0);
  const taken = occupancy.reduce((n, o) => n + o.taken, 0);

  const openByCategory = new Map<ComplaintCategory, number>();
  let resolved = 0;
  for (const c of complaints ?? []) {
    if (c.status === "RESOLVED") resolved++;
    else openByCategory.set(c.category, (openByCategory.get(c.category) ?? 0) + 1);
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <BackLink href="/more" label="More" />
        <h1 className="text-2xl font-bold text-stone-900">Reports</h1>
      </div>

      <form className={`${card} flex flex-wrap items-end gap-2`} action="/reports">
        <label className="text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="mt-1 block min-h-11 rounded-lg border border-stone-300 px-2"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            className="mt-1 block min-h-11 rounded-lg border border-stone-300 px-2"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Show
        </button>
      </form>

      <div className={card} data-testid="pg-collections">
        <h2 className="text-sm font-medium text-stone-500">
          Collected {formatDate(range.from)} – {formatDate(range.to)}
        </h2>
        <p className="text-3xl font-bold">{formatRupees(moneyIn.total)}</p>
        <p className="text-sm text-stone-600">
          Rent {formatRupees(rentIn)} · Deposits {formatRupees(depositIn)}
          {refunds ? ` · Refunds paid ${formatRupees(refunds)}` : ""}
        </p>
        {moneyIn.byMode.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <dl className="grid grid-cols-[1fr_auto] gap-x-3">
              {moneyIn.byMode.map((m) => (
                <div key={m.mode} className="contents">
                  <dt>{MODE_LABEL[m.mode]}</dt>
                  <dd className="text-right">{formatRupees(m.amount)}</dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3">
              {moneyIn.byStaff.map((s) => (
                <div key={s.userId ?? "x"} className="contents">
                  <dt className="truncate">
                    {(s.userId && names.get(s.userId)) ?? "Former staff"}
                  </dt>
                  <dd className="text-right">{formatRupees(s.amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className={card} data-testid="pg-dues">
        <h2 className="text-sm font-medium text-stone-500">Rent outstanding</h2>
        <p className="text-3xl font-bold text-red-700">{formatRupees(totalDue)}</p>
        <p className="text-sm text-stone-600">Deposits held: {formatRupees(depositsHeld)}</p>
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {dues.map(({ stay, dues: d }) => (
            <li key={stay.id}>
              <Link href={`/residents/${stay.id}`} className="flex justify-between gap-3 py-2">
                <span>
                  {stay.customer?.name}
                  <span className="block text-xs text-stone-500">
                    {placeLabel(stay.room?.name ?? "?", stay.bed?.label ?? null)}
                    {d.daysOverdue ? ` · ${d.daysOverdue} days late` : " · due today"}
                  </span>
                </span>
                <span className="font-semibold">{formatRupees(d.amountDue)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className={card} data-testid="pg-occupancy">
        <h2 className="text-sm font-medium text-stone-500">Occupancy</h2>
        <p className="text-3xl font-bold">
          {places ? Math.round((taken / places) * 100) : 0}%{" "}
          <span className="text-base font-normal text-stone-600">
            ({taken} of {places})
          </span>
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3">
          {occupancy.map((o) => (
            <li key={o.r.id} className="flex justify-between py-1">
              <span>Room {o.r.name}</span>
              <span className={o.taken < o.places ? "text-green-700" : ""}>
                {o.taken}/{o.places}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={card} data-testid="pg-complaints-summary">
        <h2 className="text-sm font-medium text-stone-500">Complaints</h2>
        <p className="text-sm">
          {[...openByCategory.values()].reduce((a, b) => a + b, 0)} open · {resolved} resolved
        </p>
        <ul className="mt-2 text-sm">
          {[...openByCategory.entries()].map(([c, n]) => (
            <li key={c}>
              {COMPLAINT_CATEGORY_LABEL[c]}: {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
