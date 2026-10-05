"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant, requireTenantAdmin } from "@/lib/auth/guards";
import { isIsoDate } from "@/lib/dates";
import { formatRupees, parseRupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// One resident's stay. The business always comes from the session (RLS and
// the database functions); ids in the form only pick a row the caller can
// already see.

export type ActionState = { error?: string; done?: string };

const MODES = ["CASH", "UPI", "CARD", "OTHER"] as const;
// Messages raised by the database functions are written for people.
const FRIENDLY = new Set(["22023", "23503", "23505", "23514", "42501"]);
const friendly = (e: { code?: string; message: string }, fallback: string) =>
  e.code && FRIENDLY.has(e.code) ? e.message : fallback;

const stayIdOf = (fd: FormData) => z.uuid().safeParse(fd.get("stayId"));
function refresh(stayId: string) {
  revalidatePath(`/residents/${stayId}`);
  revalidatePath("/residents");
  revalidatePath("/rooms");
  revalidatePath("/");
}

export async function recordPgPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const purpose = z.enum(["RENT", "DEPOSIT", "REFUND"]).safeParse(fd.get("purpose"));
  if (!purpose.success) return { error: "Choose what the payment is for." };
  const amount = parseRupeesToPaise(String(fd.get("amount") ?? ""));
  if (!amount) return { error: "Enter the amount, like 6000." };
  const mode = z.enum(MODES).safeParse(fd.get("mode"));
  if (!mode.success) return { error: "Choose how it was paid." };
  const note = String(fd.get("note") ?? "").trim();
  if (note.length > 200) return { error: "Keep the note under 200 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_payments")
    .insert({
      stay_id: stayId.data,
      purpose: purpose.data,
      amount_paise: amount,
      mode: mode.data,
      note: note || null,
    })
    .select("id")
    .single();
  if (error) return { error: friendly(error, "Couldn't record the payment. Please try again.") };
  await logAudit("pg.payment_recorded", "pg_payment", data.id, {
    stay_id: stayId.data,
    purpose: purpose.data,
    amount_paise: amount,
    mode: mode.data,
  });
  refresh(stayId.data);
  return {
    done:
      purpose.data === "REFUND"
        ? `Refund of ${formatRupees(amount)} recorded.`
        : `${formatRupees(amount)} recorded.`,
  };
}

export async function reversePgPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const paymentId = z.uuid().safeParse(fd.get("paymentId"));
  if (!paymentId.success) return { error: "Payment not found." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for the reversal." };
  if (reason.length > 200) return { error: "Keep the reason under 200 characters." };
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("pg_payments")
    .select("id, stay_id, amount_paise, kind, purpose")
    .eq("id", paymentId.data)
    .maybeSingle();
  if (!original || original.kind !== "PAYMENT") return { error: "Payment not found." };
  const { data, error } = await supabase
    .from("pg_payments")
    .insert({
      stay_id: original.stay_id,
      purpose: original.purpose,
      kind: "REVERSAL",
      amount_paise: -original.amount_paise,
      mode: "OTHER", // replaced with the original's mode by the database
      reverses_payment_id: original.id,
      note: reason,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "This payment was already reversed." };
    return { error: friendly(error, "Couldn't reverse the payment.") };
  }
  await logAudit("pg.payment_reversed", "pg_payment", data.id, {
    reverses: original.id,
    amount_paise: original.amount_paise,
    reason,
  });
  refresh(original.stay_id);
  return { done: "Payment reversed." };
}

export async function addAdjustment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const kind = z.enum(["CHARGE", "DISCOUNT"]).safeParse(fd.get("kind"));
  if (!kind.success) return { error: "Choose extra charge or discount." };
  const amount = parseRupeesToPaise(String(fd.get("amount") ?? ""));
  if (!amount || amount > 100000000) return { error: "Enter a valid amount." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 2 || reason.length > 200) return { error: "Give a short reason." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("pg_add_adjustment", {
    p_stay_id: stayId.data,
    p_kind: kind.data,
    p_amount_paise: amount,
    p_reason: reason,
  });
  if (error) return { error: friendly(error, "Couldn't save. Please try again.") };
  await logAudit("pg.adjustment_added", "pg_stay", stayId.data, {
    adjustment_id: id,
    kind: kind.data,
    amount_paise: amount,
    reason,
  });
  refresh(stayId.data);
  return { done: kind.data === "CHARGE" ? "Extra charge added." : "Discount added." };
}

export async function changeRates(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const from = String(fd.get("effectiveFrom") ?? "");
  if (!isIsoDate(from)) return { error: "Choose the due date the new rates start from." };
  const rent = parseRupeesToPaise(String(fd.get("rent") ?? ""));
  const electricity = parseRupeesToPaise(String(fd.get("electricity") ?? "0") || "0");
  if (rent === null || rent > 100000000) return { error: "Enter a valid rent." };
  if (electricity === null || electricity > 10000000)
    return { error: "Enter a valid electricity amount." };
  const mealRaw = String(fd.get("mealPlanId") ?? "");
  const meal = mealRaw ? z.uuid().safeParse(mealRaw) : null;
  if (meal && !meal.success) return { error: "Choose a meal plan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pg_change_rates", {
    p_stay_id: stayId.data,
    p_effective_from: from,
    p_rent_paise: rent,
    p_meal_plan_id: meal?.success ? meal.data : (null as unknown as string),
    p_electricity_paise: electricity,
  });
  if (error) return { error: friendly(error, "Couldn't save. Please try again.") };
  await logAudit("pg.rates_changed", "pg_stay", stayId.data, {
    effective_from: from,
    rent_paise: rent,
    meal_plan_id: meal?.success ? meal.data : null,
    electricity_paise: electricity,
  });
  refresh(stayId.data);
  return { done: "New rates saved. Months already due are unchanged." };
}

export async function giveNotice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const noticeOn = String(fd.get("noticeOn") ?? "");
  const moveOut = String(fd.get("plannedMoveOut") ?? "");
  if (!isIsoDate(noticeOn) || !isIsoDate(moveOut)) return { error: "Choose both dates." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pg_give_notice", {
    p_stay_id: stayId.data,
    p_notice_on: noticeOn,
    p_planned_move_out: moveOut,
  });
  if (error) return { error: friendly(error, "Couldn't save. Please try again.") };
  await logAudit("pg.notice_given", "pg_stay", stayId.data, {
    notice_on: noticeOn,
    planned_move_out: moveOut,
  });
  refresh(stayId.data);
  return { done: "Notice recorded." };
}

export async function withdrawNotice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pg_withdraw_notice", { p_stay_id: stayId.data });
  if (error) return { error: friendly(error, "Couldn't save. Please try again.") };
  await logAudit("pg.notice_withdrawn", "pg_stay", stayId.data, {});
  refresh(stayId.data);
  return { done: "Notice withdrawn." };
}

export async function settleMoveOut(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const movedOutOn = String(fd.get("movedOutOn") ?? "");
  if (!isIsoDate(movedOutOn)) return { error: "Choose the move-out date." };
  const deductions: { amount_paise: number; reason: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const rawAmount = String(fd.get(`deductionAmount${i}`) ?? "").trim();
    const reason = String(fd.get(`deductionReason${i}`) ?? "").trim();
    if (!rawAmount && !reason) continue;
    const amount = parseRupeesToPaise(rawAmount);
    if (!amount || amount > 100000000) return { error: `Deduction ${i}: enter a valid amount.` };
    if (reason.length < 2 || reason.length > 200)
      return { error: `Deduction ${i}: give a reason.` };
    deductions.push({ amount_paise: amount, reason });
  }
  const supabase = await createClient();
  const { data: final, error } = await supabase.rpc("pg_settle_move_out", {
    p_stay_id: stayId.data,
    p_moved_out_on: movedOutOn,
    p_deductions: deductions,
  });
  if (error) return { error: friendly(error, "Couldn't save the move-out. Please try again.") };
  await logAudit("pg.moved_out", "pg_stay", stayId.data, {
    moved_out_on: movedOutOn,
    deductions,
    final_paise: final,
  });
  refresh(stayId.data);
  return {
    done:
      final > 0
        ? `Moved out. Collect ${formatRupees(final)} from the resident.`
        : final < 0
          ? `Moved out. Refund ${formatRupees(-final)} to the resident.`
          : "Moved out. Everything is settled.",
  };
}

export async function cancelStay(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const stayId = stayIdOf(fd);
  if (!stayId.success) return { error: "Resident not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pg_cancel_stay", { p_stay_id: stayId.data });
  if (error) return { error: friendly(error, "Couldn't cancel. Please try again.") };
  await logAudit("pg.stay_cancelled", "pg_stay", stayId.data, {});
  refresh(stayId.data);
  return { done: "Stay cancelled. The bed is free again." };
}

/** Privacy request: permanently deletes the photo file, keeps a "removed" record. */
export async function removeIdPhoto(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // Allowed even when the business is read-only.
  await requireTenantAdmin({ write: false, type: "HOSTEL_PG" });
  const docId = z.uuid().safeParse(fd.get("docId"));
  if (!docId.success) return { error: "Photo not found." };
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("pg_id_documents")
    .select("id, storage_path, customer_id, removed_at")
    .eq("id", docId.data)
    .maybeSingle();
  if (!doc || doc.removed_at) return { error: "Photo not found." };
  const { error: storageError } = await supabase.storage
    .from("resident-ids")
    .remove([doc.storage_path]);
  if (storageError) return { error: "Couldn't delete the photo. Please try again." };
  const { error } = await supabase
    .from("pg_id_documents")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", doc.id);
  if (error) return { error: "The photo was deleted but the record wasn't updated." };
  await logAudit("pg.id_removed", "pg_id_document", doc.id, { customer_id: doc.customer_id });
  revalidatePath("/residents", "layout");
  return { done: "Photo deleted permanently." };
}
