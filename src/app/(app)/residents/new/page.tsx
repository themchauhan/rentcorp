import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { requireActiveTenant } from "@/lib/auth/guards";
import { todayIST } from "@/lib/dates";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { MoveInForm, type PlaceOption } from "./move-in-form";

export const metadata: Metadata = { title: "Move in" };

export default async function MoveInPage({ searchParams }: PageProps<"/residents/new">) {
  const member = await requireActiveTenant({ type: "HOSTEL_PG" });
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const supabase = await createClient();
  const [{ data: rooms }, { data: live }, { data: plans }, { data: settings }] = await Promise.all([
    supabase
      .from("pg_rooms")
      .select(
        "id, name, floor, rent_mode, rent_paise, under_maintenance, beds:pg_beds (id, label, under_maintenance, active)",
      )
      .eq("active", true)
      .eq("under_maintenance", false)
      .order("name"),
    supabase.from("pg_stays").select("room_id, bed_id").in("status", ["ACTIVE", "NOTICE"]),
    supabase
      .from("pg_meal_plans")
      .select("id, name, monthly_paise")
      .eq("active", true)
      .order("name"),
    supabase.from("pg_settings").select("deposit_paise, electricity_paise").maybeSingle(),
  ]);

  const takenBeds = new Set((live ?? []).map((s) => s.bed_id).filter(Boolean));
  const takenRooms = new Set((live ?? []).map((s) => s.room_id));
  const places: PlaceOption[] = [];
  for (const r of rooms ?? []) {
    const beds = r.beds.filter((b) => b.active).sort((a, b) => a.label.localeCompare(b.label));
    if (r.rent_mode === "PER_ROOM") {
      if (!takenRooms.has(r.id))
        places.push({
          value: `room:${r.id}`,
          label: `Room ${r.name} · whole room (${beds.length} beds) · ${formatRupees(r.rent_paise)}/month`,
        });
    } else {
      for (const b of beds)
        if (!b.under_maintenance && !takenBeds.has(b.id))
          places.push({
            value: `bed:${b.id}`,
            label: `Room ${r.name} · Bed ${b.label} · ${formatRupees(r.rent_paise)}/month`,
          });
    }
  }
  const pre = one(sp.bed) ? `bed:${one(sp.bed)}` : one(sp.room) ? `room:${one(sp.room)}` : "";

  return (
    <section className="max-w-lg">
      <BackLink href="/residents" label="Residents" />
      <h1 className="mt-2 mb-1 text-2xl font-bold text-stone-900">Move in</h1>
      <p className="mb-6 text-stone-600">
        Rent is due on the joining date every month. Electricity{" "}
        {formatRupees(settings?.electricity_paise ?? 0)}/month is added from Hostel setup.
      </p>
      {places.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          No vacant beds or rooms right now.
        </p>
      ) : (
        <MoveInForm
          places={places}
          plans={(plans ?? []).map((p) => ({
            value: p.id,
            label: `${p.name} · ${formatRupees(p.monthly_paise)}/month`,
          }))}
          isOwner={member.role === "ADMIN"}
          initial={{
            place: places.some((p) => p.value === pre) ? pre : "",
            startDate: todayIST(),
            deposit: paiseToRupeesInput(settings?.deposit_paise ?? 0),
          }}
        />
      )}
    </section>
  );
}
