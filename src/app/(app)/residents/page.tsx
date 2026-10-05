import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantMember } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { placeLabel, STAY_STATUS_LABEL } from "@/lib/pg";
import { duesFor, loadLiveStays, STAY_SELECT } from "@/lib/pg-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Residents" };

type Show = "live" | "dues" | "notice" | "moved";

export default async function ResidentsPage({ searchParams }: PageProps<"/residents">) {
  const profile = await requireTenantMember({ type: "HOSTEL_PG" });
  const sp = await searchParams;
  const raw = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show: Show = raw === "dues" || raw === "notice" || raw === "moved" ? raw : "live";
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().toLowerCase() ?? "";

  const supabase = await createClient();
  let rows;
  if (show === "moved") {
    const { data, error } = await supabase
      .from("pg_stays")
      .select(STAY_SELECT)
      .eq("status", "MOVED_OUT")
      .order("moved_out_on", { ascending: false })
      .limit(100);
    if (error) throw new Error("Couldn't load residents");
    rows = (data ?? []).map((s) => ({ stay: s, dues: duesFor(s) }));
  } else {
    rows = await loadLiveStays(supabase);
    if (show === "dues") rows = rows.filter((r) => r.dues.amountDue > 0);
    if (show === "notice") rows = rows.filter((r) => r.stay.status === "NOTICE");
  }
  if (q)
    rows = rows.filter(
      (r) =>
        r.stay.customer?.name.toLowerCase().includes(q) ||
        r.stay.customer?.mobile.includes(q) ||
        r.stay.room?.name.toLowerCase() === q,
    );
  rows.sort(
    (a, b) => b.dues.daysOverdue - a.dues.daysOverdue || b.dues.amountDue - a.dues.amountDue,
  );

  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm ${
      active
        ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
        : "border-stone-300 bg-white text-stone-700"
    }`;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Residents</h1>
        {!profile.readOnly && (
          <Link
            href="/residents/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            Move in
          </Link>
        )}
      </div>

      <form action="/residents" role="search" className="flex gap-2">
        {show !== "live" && <input type="hidden" name="show" value={show} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name, mobile or room"
          aria-label="Search residents"
          className="block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Search
        </button>
      </form>

      <nav aria-label="Show" className="flex gap-2 overflow-x-auto">
        <Link href="/residents" className={chip(show === "live")}>
          Living here
        </Link>
        <Link href="/residents?show=dues" className={chip(show === "dues")}>
          Rent due
        </Link>
        <Link href="/residents?show=notice" className={chip(show === "notice")}>
          On notice
        </Link>
        <Link href="/residents?show=moved" className={chip(show === "moved")}>
          Moved out
        </Link>
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          No residents here.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ stay, dues }) => (
            <li key={stay.id} data-testid="resident-row">
              <Link
                href={`/residents/${stay.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{stay.customer?.name}</p>
                    <p className="text-sm text-stone-600">
                      {placeLabel(stay.room?.name ?? "?", stay.bed?.label ?? null)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {stay.status === "MOVED_OUT" ? (
                      <span className="text-stone-600">
                        Moved out {stay.moved_out_on ? formatDate(stay.moved_out_on) : ""}
                        {dues.final !== 0 && (
                          <span className="block font-medium text-red-700">
                            {dues.final > 0
                              ? `To collect ${formatRupees(dues.final)}`
                              : `Refund ${formatRupees(-dues.final)}`}
                          </span>
                        )}
                      </span>
                    ) : dues.amountDue > 0 ? (
                      <span className="font-semibold text-red-700">
                        Due {formatRupees(dues.amountDue)}
                        {dues.daysOverdue > 0 && (
                          <span className="block text-xs font-normal">
                            {dues.daysOverdue} days late
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-green-700">
                        Paid
                        {dues.nextDueDate && (
                          <span className="block text-xs text-stone-500">
                            Next {formatDate(dues.nextDueDate)}
                          </span>
                        )}
                      </span>
                    )}
                    {stay.status === "NOTICE" && (
                      <span className="mt-1 block rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-800">
                        {STAY_STATUS_LABEL.NOTICE}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
