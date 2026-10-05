import Link from "next/link";
import { SendPanel } from "@/components/send-panel";
import type { TenantMember } from "@/lib/auth/guards";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { COMPLAINT_CATEGORY_LABEL, placeLabel } from "@/lib/pg";
import { buildPgMessage } from "@/lib/pg-messages";
import { loadLiveStays, loadPgTemplates, type LiveStay } from "@/lib/pg-server";
import { createClient } from "@/lib/supabase/server";

const card = "rounded-2xl border border-stone-200 bg-white p-4";

function DueList({
  list,
  testId,
  businessName,
  readOnly,
  template,
  today,
}: {
  list: LiveStay[];
  testId: string;
  businessName: string;
  readOnly: boolean;
  template: string;
  today: string;
}) {
  return (
    <ul className="space-y-3" data-testid={testId}>
      {list.map(({ stay, dues }) => {
        const place = placeLabel(stay.room?.name ?? "?", stay.bed?.label ?? null);
        const ctx = {
          business: businessName,
          resident: stay.customer?.name ?? "",
          place,
          asOf: today,
          dues,
          lastPayment: null,
        };
        return (
          <li
            key={stay.id}
            className="rounded-xl border border-stone-200 p-3"
            data-testid="due-row"
          >
            <Link href={`/residents/${stay.id}`} className="flex items-start justify-between gap-3">
              <span>
                <span className="font-semibold">{stay.customer?.name}</span>
                <span className="block text-sm text-stone-600">{place}</span>
              </span>
              <span className="text-right font-semibold text-red-700">
                {formatRupees(dues.amountDue)}
                {dues.daysOverdue > 0 && (
                  <span className="block text-xs font-normal">{dues.daysOverdue} days late</span>
                )}
              </span>
            </Link>
            {!readOnly && stay.customer && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-brand-700">
                  Send rent reminder
                </summary>
                <div className="mt-2">
                  <SendPanel
                    stayId={stay.id}
                    type="RENT_DUE"
                    title="Rent due message"
                    whatsappText={buildPgMessage("RENT_DUE", ctx, template, "WHATSAPP")}
                    smsText={buildPgMessage("RENT_DUE", ctx, template, "SMS")}
                    mobile={stay.customer.mobile}
                    whatsappNumber={stay.customer.whatsapp_number}
                    preferredChannel={stay.customer.preferred_channel}
                  />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Home for a hostel / PG: who owes rent, who's leaving, what's broken. */
export async function PgHome({ profile }: { profile: TenantMember }) {
  const supabase = await createClient();
  const today = todayIST();
  const [live, { data: rooms }, { data: complaints }, templates] = await Promise.all([
    loadLiveStays(supabase),
    supabase
      .from("pg_rooms")
      .select("id, rent_mode, under_maintenance, beds:pg_beds (id, active, under_maintenance)")
      .eq("active", true),
    supabase
      .from("pg_complaints")
      .select("id, category, priority, description, room:pg_rooms (name)")
      .neq("status", "RESOLVED")
      .order("raised_at", { ascending: false })
      .limit(50),
    loadPgTemplates(supabase),
  ]);

  // Occupancy: a whole-room let counts as one place.
  let places = 0;
  let usable = 0;
  for (const r of rooms ?? []) {
    const beds = r.beds.filter((b) => b.active);
    const slots = r.rent_mode === "PER_ROOM" ? (beds.length ? 1 : 0) : beds.length;
    places += slots;
    usable +=
      r.rent_mode === "PER_ROOM"
        ? r.under_maintenance
          ? 0
          : slots
        : beds.filter((b) => !b.under_maintenance && !r.under_maintenance).length;
  }
  const occupied = live.length;
  const vacant = Math.max(0, usable - occupied);
  const pct = places ? Math.round((occupied / places) * 100) : 0;

  const due = live
    .filter((s) => s.dues.amountDue > 0)
    .sort((a, b) => b.dues.daysOverdue - a.dues.daysOverdue || b.dues.amountDue - a.dues.amountDue);
  const dueToday = due.filter((s) => s.dues.daysOverdue === 0);
  const overdue = due.filter((s) => s.dues.daysOverdue > 0);
  const leaving = live
    .filter(
      (s) => s.stay.status === "NOTICE" && (s.stay.planned_move_out ?? "") <= addDays(today, 7),
    )
    .sort((a, b) => (a.stay.planned_move_out ?? "").localeCompare(b.stay.planned_move_out ?? ""));
  const open = [...(complaints ?? [])].sort(
    (a, b) => Number(b.priority === "URGENT") - Number(a.priority === "URGENT"),
  );
  const totalDue = due.reduce((n, s) => n + s.dues.amountDue, 0);
  const listProps = {
    businessName: profile.tenant.name,
    readOnly: profile.readOnly,
    template: templates.RENT_DUE,
    today,
  };

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-900">Today</h1>

      <div className="grid grid-cols-3 gap-2" data-testid="pg-stats">
        <Link href="/rooms" className={`${card} text-center`}>
          <span className="block text-2xl font-bold">{pct}%</span>
          <span className="text-xs text-stone-600">occupied</span>
        </Link>
        <Link href="/rooms?show=vacant" className={`${card} text-center`}>
          <span className="block text-2xl font-bold">{vacant}</span>
          <span className="text-xs text-stone-600">vacant</span>
        </Link>
        <Link href="/residents?show=dues" className={`${card} text-center`}>
          <span className="block text-lg font-bold text-red-700">{formatRupees(totalDue)}</span>
          <span className="text-xs text-stone-600">rent due</span>
        </Link>
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">Rent due today ({dueToday.length})</h2>
        {dueToday.length ? (
          <DueList list={dueToday} testId="due-today" {...listProps} />
        ) : (
          <p className="text-sm text-stone-600">Nobody’s rent falls due today.</p>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-3 text-lg font-semibold">Overdue ({overdue.length})</h2>
        {overdue.length ? (
          <DueList list={overdue} testId="overdue" {...listProps} />
        ) : (
          <p className="text-sm text-stone-600">No overdue rent.</p>
        )}
      </div>

      <div className={card} data-testid="leaving">
        <h2 className="mb-3 text-lg font-semibold">Leaving this week</h2>
        {leaving.length ? (
          <ul className="divide-y divide-stone-100">
            {leaving.map(({ stay }) => (
              <li key={stay.id} className="py-2">
                <Link href={`/residents/${stay.id}`} className="flex justify-between gap-3">
                  <span>
                    {stay.customer?.name}
                    <span className="block text-sm text-stone-600">
                      {placeLabel(stay.room?.name ?? "?", stay.bed?.label ?? null)}
                    </span>
                  </span>
                  <span className="text-sm">
                    {stay.planned_move_out ? formatDate(stay.planned_move_out) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">No one is moving out this week.</p>
        )}
      </div>

      <div className={card} data-testid="open-complaints">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Open complaints ({open.length})</h2>
          <Link href="/complaints" className="text-sm font-medium text-brand-700">
            All
          </Link>
        </div>
        {open.length ? (
          <ul className="divide-y divide-stone-100">
            {open.slice(0, 5).map((c) => (
              <li key={c.id} className="py-2">
                <Link href={`/complaints/${c.id}`} className="block">
                  <span className="font-medium">
                    {COMPLAINT_CATEGORY_LABEL[c.category]}
                    {c.room ? ` · Room ${c.room.name}` : ""}
                  </span>
                  {c.priority === "URGENT" && (
                    <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                      Urgent
                    </span>
                  )}
                  <span className="block truncate text-sm text-stone-600">{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">Nothing pending.</p>
        )}
      </div>
    </section>
  );
}
