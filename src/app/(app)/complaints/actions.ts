"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant } from "@/lib/auth/guards";
import { COMPLAINT_CATEGORIES } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

// Maintenance complaints: any member of a hostel/PG can log and update
// them. Never deleted; who raised / resolved is stamped by the database.

export type ComplaintState = { error?: string; done?: string; values?: Record<string, string> };

export async function raiseComplaint(_prev: ComplaintState, fd: FormData): Promise<ComplaintState> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const values = Object.fromEntries(
    [...fd.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const category = z.enum(COMPLAINT_CATEGORIES).safeParse(fd.get("category"));
  if (!category.success) return { values, error: "Choose what the problem is about." };
  const description = String(fd.get("description") ?? "").trim();
  if (description.length < 2 || description.length > 1000)
    return { values, error: "Describe the problem (up to 1000 characters)." };
  const where = /^(room|stay):([0-9a-f-]{36})$/.exec(String(fd.get("where") ?? ""));
  const urgent = fd.get("urgent") === "on";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_complaints")
    .insert({
      category: category.data,
      description,
      priority: urgent ? "URGENT" : "NORMAL",
      room_id: where?.[1] === "room" ? where[2] : null,
      stay_id: where?.[1] === "stay" ? where[2] : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23503") return { values, error: "That room or resident wasn't found." };
    console.error("raiseComplaint failed:", error.message);
    return { values, error: "Couldn't save. Please try again." };
  }
  await logAudit("pg.complaint_raised", "pg_complaint", data.id, {
    category: category.data,
    priority: urgent ? "URGENT" : "NORMAL",
  });
  revalidatePath("/complaints");
  revalidatePath("/");
  redirect(`/complaints/${data.id}?created=1`);
}

export async function updateComplaint(
  _prev: ComplaintState,
  fd: FormData,
): Promise<ComplaintState> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("complaintId"));
  if (!id.success) return { error: "Complaint not found." };
  const status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).safeParse(fd.get("status"));
  if (!status.success) return { error: "Choose a status." };
  const note = String(fd.get("note") ?? "").trim();
  if (note.length > 500) return { error: "Keep the note under 500 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_complaints")
    .update({ status: status.data, ...(note ? { resolution_note: note } : {}) })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update. Please try again." };
  await logAudit("pg.complaint_updated", "pg_complaint", id.data, { status: status.data });
  revalidatePath("/complaints");
  revalidatePath(`/complaints/${id.data}`);
  revalidatePath("/");
  return {
    done:
      status.data === "RESOLVED"
        ? "Marked resolved."
        : status.data === "IN_PROGRESS"
          ? "Marked in progress."
          : "Reopened.",
  };
}
