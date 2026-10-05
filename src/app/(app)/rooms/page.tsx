import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantMember } from "@/lib/auth/guards";
import { formatRupees } from "@/lib/money";
import { RENT_MODE_LABEL } from "@/lib/pg";
import { loadLiveStays, type LiveStay } from "@/lib/pg-server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rooms" };

type Filter = "all" | "vacant" | "dues";

export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  const profile = await requireTenantMember({ type: "HOSTEL_PG" });
  const isOwner = profile.role === "ADMIN" && !profile.readOnly;
  const canWrite = !profile.readOnly;
  const raw = (await searchParams).show;
  const filter: Filter = raw === "vacant" || raw === "dues" ? raw : "all";

  const supabase = await createClient();
  const [{ data: rooms, error }, live] = await Promise.all([
    supabase
      .from("pg_rooms")
      .select(
        "id, name, floor, rent_mode, rent_paise, under_maintenance, beds:pg_beds (id, label, under_maintenance, active)",
      )
      .eq("active", true)
      .order("floor", { nullsFirst: true })
      .order("name"),
    loadLiveStays(supabase),
  ]);
  if (error) throw new Error("Couldn't load rooms");

  const byBed = new Map<string, LiveStay>();
  const byRoom = new Map<string, LiveStay>();
  for (const s of live) {
    if (s.stay.bed) byBed.set(s.stay.bed.id, s);
    else if (s.stay.room) byRoom.set(s.stay.room.id, s);
  }

  type Slot = {
    key: string;
    label: string;
    stay: LiveStay | null;
    maintenance: boolean;
    href: string;
  };
  const slotsFor = (room: NonNullable<typeof rooms>[number]): Slot[] => {
    const beds = room.beds.filter((b) => b.active).sort((a, b) => a.label.localeCompare(b.label));
    if (room.rent_mode === "PER_ROOM") {
      const stay = byRoom.get(room.id) ?? null;
      return [
        {
          key: room.id,
          label: `Whole room · ${beds.length} ${beds.length === 1 ? "bed" : "beds"}`,
          stay,
          maintenance: room.under_maintenance,
          href: stay ? `/residents/${stay.stay.id}` : `/residents/new?room=${room.id}`,
        },
      ];
    }
    return beds.map((b) => {
      const stay = byBed.get(b.id) ?? null;
      return {
        key: b.id,
        label: `Bed ${b.label}`,
        stay,
        maintenance: room.under_maintenance || b.under_maintenance,
        href: stay ? `/residents/${stay.stay.id}` : `/residents/new?bed=${b.id}`,
      };
    });
  };

  const all = (rooms ?? []).map((r) => ({ room: r, slots: slotsFor(r) }));
  const totalSlots = all.reduce((n, r) => n + r.slots.length, 0);
  const vacant = all.reduce(
    (n, r) => n + r.slots.filter((s) => !s.stay && !s.maintenance).length,
    0,
  );
  const occupied = all.reduce((n, r) => n + r.slots.filter((s) => s.stay).length, 0);
  const shown = all
    .map((r) => ({
      ...r,
      slots: r.slots.filter((s) =>
        filter === "vacant"
          ? !s.stay && !s.maintenance
          : filter === "dues"
            ? (s.stay?.dues.amountDue ?? 0) > 0
            : true,
      ),
    }))
    .filter((r) => r.slots.length > 0 || filter === "all");

  const floors = new Map<string, typeof shown>();
  for (const r of shown) {
    const f = r.room.floor ?? "Rooms";
    floors.set(f, [...(floors.get(f) ?? []), r]);
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm ${
      active
        ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
        : "border-stone-300 bg-white text-stone-700"
    }`;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Rooms</h1>
        {isOwner && (
          <Link
            href="/rooms/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            Add room
          </Link>
        )}
      </div>

      <p className="text-sm text-stone-600" data-testid="occupancy">
        {occupied} of {totalSlots} occupied · {vacant} vacant
      </p>

      <nav aria-label="Show" className="flex gap-2 overflow-x-auto">
        <Link href="/rooms" className={chip(filter === "all")}>
          All
        </Link>
        <Link href="/rooms?show=vacant" className={chip(filter === "vacant")}>
          Vacant
        </Link>
        <Link href="/rooms?show=dues" className={chip(filter === "dues")}>
          Rent due
        </Link>
      </nav>

      {all.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          No rooms yet.{isOwner ? " Add your first room to start." : ""}
        </p>
      )}

      {[...floors.entries()].map(([floor, list]) => (
        <div key={floor} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{floor}</h2>
          {list.map(({ room, slots }) => (
            <div
              key={room.id}
              className="rounded-2xl border border-stone-200 bg-white p-4"
              data-testid="room-card"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Room {room.name}</p>
                  <p className="text-sm text-stone-600">
                    {RENT_MODE_LABEL[room.rent_mode]} · {formatRupees(room.rent_paise)}/month
                    {room.under_maintenance ? " · Under maintenance" : ""}
                  </p>
                </div>
                {isOwner && (
                  <Link href={`/rooms/${room.id}`} className="text-sm font-medium text-brand-700">
                    Edit
                  </Link>
                )}
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {slots.map((s) => {
                  const due = s.stay?.dues.amountDue ?? 0;
                  const tone = s.stay
                    ? s.stay.stay.status === "NOTICE"
                      ? "border-amber-300 bg-amber-50"
                      : "border-stone-200 bg-stone-50"
                    : s.maintenance
                      ? "border-stone-200 bg-stone-100 text-stone-500"
                      : "border-green-300 bg-green-50";
                  const body = (
                    <>
                      <span className="font-medium">{s.label}</span>
                      <span className="block text-sm">
                        {s.stay
                          ? s.stay.stay.customer?.name
                          : s.maintenance
                            ? "Under maintenance"
                            : "Vacant"}
                        {s.stay?.stay.status === "NOTICE" ? " · on notice" : ""}
                      </span>
                      {due > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-red-100 px-2 text-xs font-medium text-red-800">
                          Due {formatRupees(due)}
                        </span>
                      )}
                    </>
                  );
                  const cls = `block min-h-14 rounded-lg border p-3 ${tone}`;
                  return (
                    <li key={s.key} data-testid="bed-slot">
                      {s.stay || (!s.maintenance && canWrite) ? (
                        <Link href={s.href} className={cls}>
                          {body}
                        </Link>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
