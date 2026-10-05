import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { requireActiveTenant } from "@/lib/auth/guards";
import { placeLabel } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";
import { ComplaintForm } from "./complaint-form";

export const metadata: Metadata = { title: "New complaint" };

export default async function NewComplaintPage() {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const supabase = await createClient();
  const [{ data: stays }, { data: rooms }] = await Promise.all([
    supabase
      .from("pg_stays")
      .select("id, customer:rental_customers (name), room:pg_rooms (name), bed:pg_beds (label)")
      .in("status", ["ACTIVE", "NOTICE"]),
    supabase.from("pg_rooms").select("id, name").eq("active", true).order("name"),
  ]);
  const options = [
    ...(stays ?? [])
      .map((s) => ({
        value: `stay:${s.id}`,
        label: `${s.customer?.name} · ${placeLabel(s.room?.name ?? "?", s.bed?.label ?? null)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...(rooms ?? []).map((r) => ({ value: `room:${r.id}`, label: `Room ${r.name} (no resident)` })),
  ];
  return (
    <section className="max-w-lg">
      <BackLink href="/complaints" label="Complaints" />
      <h1 className="mt-2 mb-6 text-2xl font-bold text-stone-900">New complaint</h1>
      <ComplaintForm options={options} />
    </section>
  );
}
