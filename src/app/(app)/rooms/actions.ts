"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { roomFormSchema, type RoomFormField, type RoomFormInput } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

// Rooms and beds: owners only, hostel/PG businesses only. tenant_id is
// never sent: the database takes it from the session.

export type RoomFormState = {
  error?: string;
  done?: string;
  fieldErrors?: Partial<Record<RoomFormField, string>>;
  values?: RoomFormInput;
};
export type SimpleState = { error?: string; done?: string };

const DUPLICATE = "You already have a room with this name";

function readForm(fd: FormData): RoomFormInput {
  const get = (k: string) => String(fd.get(k) ?? "");
  return {
    name: get("name"),
    floor: get("floor"),
    rentMode: get("rentMode"),
    rent: get("rent"),
    beds: get("beds") || "1",
    notes: get("notes"),
  };
}

function parse(values: RoomFormInput) {
  const parsed = roomFormSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const errors = z.flattenError(parsed.error).fieldErrors as Partial<
    Record<RoomFormField, string[]>
  >;
  return {
    ok: false as const,
    state: {
      values,
      fieldErrors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v?.[0]])),
    } as RoomFormState,
  };
}

function refresh(roomId?: string) {
  revalidatePath("/rooms");
  if (roomId) revalidatePath(`/rooms/${roomId}`);
}

export async function createRoom(_prev: RoomFormState, fd: FormData): Promise<RoomFormState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const values = readForm(fd);
  const r = parse(values);
  if (!r.ok) return r.state;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("pg_create_room", {
    p_name: r.data.name,
    p_floor: r.data.floor,
    p_rent_mode: r.data.rentMode,
    p_rent_paise: r.data.rent,
    p_beds: r.data.beds,
    p_notes: r.data.notes,
  });
  if (error || !id) {
    if (error?.code === "23505") return { values, fieldErrors: { name: DUPLICATE } };
    console.error("createRoom failed:", error?.message);
    return { values, error: "Couldn't save the room. Please try again." };
  }
  await logAudit("pg.room_created", "pg_room", id, {
    name: r.data.name,
    rent_mode: r.data.rentMode,
    rent_paise: r.data.rent,
    beds: r.data.beds,
  });
  refresh();
  redirect("/rooms");
}

export async function updateRoom(_prev: RoomFormState, fd: FormData): Promise<RoomFormState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("roomId"));
  if (!id.success) return { error: "Room not found." };
  const values = readForm(fd);
  const r = parse(values);
  if (!r.ok) return r.state;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_rooms")
    .update({
      name: r.data.name,
      floor: r.data.floor || null,
      rent_mode: r.data.rentMode,
      rent_paise: r.data.rent,
      notes: r.data.notes || null,
      under_maintenance: fd.get("underMaintenance") === "on",
    })
    .eq("id", id.data)
    .select("id");
  if (error) {
    if (error.code === "23505") return { values, fieldErrors: { name: DUPLICATE } };
    if (error.code === "23514") return { values, error: error.message };
    console.error("updateRoom failed:", error.message);
    return { values, error: "Couldn't save. Please try again." };
  }
  if (!data?.length) return { error: "Room not found." };
  await logAudit("pg.room_updated", "pg_room", id.data, {
    rent_mode: r.data.rentMode,
    rent_paise: r.data.rent,
    under_maintenance: fd.get("underMaintenance") === "on",
  });
  refresh(id.data);
  return { done: "Saved. Existing residents keep their agreed rent." };
}

export async function removeRoom(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("roomId"));
  if (!id.success) return { error: "Room not found." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_rooms")
    .update({ active: false })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: error.code === "23514" ? error.message : "Couldn't remove the room." };
  if (!data?.length) return { error: "Room not found." };
  await logAudit("pg.room_removed", "pg_room", id.data, {});
  refresh();
  redirect("/rooms");
}

export async function addBed(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const roomId = z.uuid().safeParse(fd.get("roomId"));
  const label = z.string().trim().min(1).max(10).safeParse(fd.get("label"));
  if (!roomId.success) return { error: "Room not found." };
  if (!label.success) return { error: "Enter a bed label, e.g. D." };
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("pg_rooms")
    .select("id")
    .eq("id", roomId.data)
    .maybeSingle();
  if (!room) return { error: "Room not found." };
  const { error } = await supabase.from("pg_beds").insert({ room_id: room.id, label: label.data });
  if (error) {
    if (error.code === "23505") return { error: "This room already has a bed with that label." };
    return { error: "Couldn't add the bed." };
  }
  await logAudit("pg.bed_added", "pg_room", room.id, { label: label.data });
  refresh(room.id);
  return { done: `Bed ${label.data} added.` };
}

export async function updateBed(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const bedId = z.uuid().safeParse(fd.get("bedId"));
  const change = z
    .enum(["maintenance_on", "maintenance_off", "remove"])
    .safeParse(fd.get("change"));
  if (!bedId.success || !change.success) return { error: "Bed not found." };
  const patch =
    change.data === "remove"
      ? { active: false }
      : { under_maintenance: change.data === "maintenance_on" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_beds")
    .update(patch)
    .eq("id", bedId.data)
    .select("id, room_id");
  if (error) return { error: error.code === "23514" ? error.message : "Couldn't update the bed." };
  if (!data?.length) return { error: "Bed not found." };
  await logAudit("pg.bed_updated", "pg_bed", bedId.data, patch);
  refresh(data[0].room_id);
  return { done: "Saved." };
}
