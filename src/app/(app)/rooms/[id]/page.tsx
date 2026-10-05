import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { Field } from "@/components/ui/form";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { paiseToRupeesInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { addBed, removeRoom, updateBed, updateRoom } from "../actions";
import { RoomForm } from "../room-form";

export const metadata: Metadata = { title: "Room" };

const card = "rounded-2xl border border-stone-200 bg-white p-4";

export default async function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  await requireTenantAdmin({ write: false, type: "HOSTEL_PG" });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("pg_rooms")
    .select(
      "id, name, floor, rent_mode, rent_paise, under_maintenance, notes, active, beds:pg_beds (id, label, under_maintenance, active)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!room || !room.active) notFound();
  const { data: stays } = await supabase
    .from("pg_stays")
    .select("id, bed_id, customer:rental_customers (name)")
    .eq("room_id", room.id)
    .in("status", ["ACTIVE", "NOTICE"]);
  const beds = room.beds.filter((b) => b.active).sort((a, b) => a.label.localeCompare(b.label));
  const stayOnBed = (bedId: string) =>
    (stays ?? []).find(
      (s) => s.bed_id === bedId || (s.bed_id === null && room.rent_mode === "PER_ROOM"),
    );

  return (
    <section className="max-w-lg space-y-5">
      <div>
        <BackLink href="/rooms" label="Rooms" />
        <h1 className="mt-2 text-2xl font-bold text-stone-900">Room {room.name}</h1>
      </div>

      <div className={card}>
        <RoomForm
          action={updateRoom}
          roomId={room.id}
          submitLabel="Save room"
          initial={{
            name: room.name,
            floor: room.floor ?? "",
            rentMode: room.rent_mode,
            rent: paiseToRupeesInput(room.rent_paise),
            beds: String(beds.length),
            notes: room.notes ?? "",
            underMaintenance: room.under_maintenance,
          }}
        />
      </div>

      <div className={card} data-testid="beds">
        <h2 className="mb-3 font-semibold">Beds</h2>
        <ul className="divide-y divide-stone-100">
          {beds.map((b) => {
            const stay = stayOnBed(b.id);
            return (
              <li key={b.id} className="space-y-2 py-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-medium">Bed {b.label}</span>
                  <span className="text-sm text-stone-600">
                    {stay ? (
                      <Link href={`/residents/${stay.id}`} className="text-brand-700">
                        {stay.customer?.name}
                      </Link>
                    ) : b.under_maintenance ? (
                      "Under maintenance"
                    ) : (
                      "Vacant"
                    )}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ActionForm
                    action={updateBed}
                    hidden={{
                      bedId: b.id,
                      change: b.under_maintenance ? "maintenance_off" : "maintenance_on",
                    }}
                    label={b.under_maintenance ? "Maintenance done" : "Mark maintenance"}
                    tone="secondary"
                  />
                  {!stay && (
                    <ActionForm
                      action={updateBed}
                      hidden={{ bedId: b.id, change: "remove" }}
                      label="Remove bed"
                      tone="danger"
                      confirm={`Remove bed ${b.label}?`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <ActionForm
          action={addBed}
          hidden={{ roomId: room.id }}
          label="Add bed"
          tone="secondary"
          className="mt-3 space-y-2"
        >
          <Field label="New bed label" name="label" placeholder="e.g. D" maxLength={10} />
        </ActionForm>
      </div>

      {!(stays ?? []).length && (
        <ActionForm
          action={removeRoom}
          hidden={{ roomId: room.id }}
          label="Remove this room"
          tone="danger"
          confirm={`Remove room ${room.name}? Past residents stay on record.`}
        />
      )}
    </section>
  );
}
