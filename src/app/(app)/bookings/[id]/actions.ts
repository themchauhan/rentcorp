"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant, requireTenantAdmin } from "@/lib/auth/guards";
import { isIsoDate } from "@/lib/dates";
import { parseRupeesToPaise } from "@/lib/money";
import { parsePercentToBasisPoints } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; done?: string };

// Messages raised by the database checks are written for users; pass
// those through, hide anything else.
function friendly(error: { code?: string; message: string } | null, fallback: string): string {
  if (error && (error.code === "23514" || error.code === "22023" || error.code === "42501")) {
    return error.message;
  }
  if (error?.code === "23503") return "Booking not found.";
  if (error) console.error(fallback, error.code, error.message);
  return fallback;
}

const orderIdOf = (fd: FormData) => z.uuid().safeParse(fd.get("orderId"));

function refresh(orderId: string) {
  revalidatePath(`/bookings/${orderId}`);
  revalidatePath("/bookings");
  revalidatePath("/");
}

const returnItems = z
  .array(z.object({ lineId: z.uuid(), quantity: z.number().int().min(0).max(1_000_000) }))
  .min(1);

export async function recordReturn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant();
  const orderId = orderIdOf(fd);
  if (!orderId.success) return { error: "Booking not found." };
  const returnedOn = String(fd.get("returnedOn") ?? "");
  if (!isIsoDate(returnedOn)) return { error: "Choose the return date." };
  const notes = String(fd.get("notes") ?? "").trim();
  if (notes.length > 500) return { error: "Keep condition notes under 500 characters." };
  let items;
  try {
    items = returnItems
      .parse(JSON.parse(String(fd.get("items") ?? "[]")))
      .filter((i) => i.quantity > 0);
  } catch {
    return { error: "Enter a quantity to return." };
  }
  if (!items.length) return { error: "Enter a quantity to return." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_returns", {
    p_order_id: orderId.data,
    p_returned_on: returnedOn,
    p_items: items.map((i) => ({ line_id: i.lineId, quantity: i.quantity })),
    ...(notes ? { p_notes: notes } : {}),
  });
  if (error) return { error: friendly(error, "Couldn't record the return. Please try again.") };

  await logAudit("booking.returned", "rental_order", orderId.data, {
    returned_on: returnedOn,
    items: items.map((i) => ({ line_id: i.lineId, quantity: i.quantity })),
    notes: notes || null,
  });
  refresh(orderId.data);
  return { done: "Return recorded." };
}

const MODES = ["CASH", "UPI", "CARD", "OTHER"] as const;

export async function recordPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant();
  const orderId = orderIdOf(fd);
  if (!orderId.success) return { error: "Booking not found." };
  const amount = parseRupeesToPaise(String(fd.get("amount") ?? ""));
  if (!amount) return { error: "Enter the amount received, like 1500." };
  const mode = z.enum(MODES).safeParse(fd.get("mode"));
  if (!mode.success) return { error: "Choose how it was paid." };
  const note = String(fd.get("note") ?? "").trim();
  if (note.length > 200) return { error: "Keep the note under 200 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rental_payments")
    .insert({
      rental_order_id: orderId.data,
      amount_paise: amount,
      mode: mode.data,
      note: note || null,
    })
    .select("id")
    .single();
  if (error) return { error: friendly(error, "Couldn't record the payment. Please try again.") };

  await logAudit("payment.recorded", "rental_payment", data.id, {
    rental_order_id: orderId.data,
    amount_paise: amount,
    mode: mode.data,
  });
  refresh(orderId.data);
  return { done: "Payment recorded." };
}

export async function reversePayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin();
  const paymentId = z.uuid().safeParse(fd.get("paymentId"));
  if (!paymentId.success) return { error: "Payment not found." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for the reversal." };
  if (reason.length > 200) return { error: "Keep the reason under 200 characters." };

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("rental_payments")
    .select("id, rental_order_id, amount_paise, kind")
    .eq("id", paymentId.data)
    .maybeSingle();
  if (!original || original.kind !== "PAYMENT") return { error: "Payment not found." };

  const { data, error } = await supabase
    .from("rental_payments")
    .insert({
      rental_order_id: original.rental_order_id,
      kind: "REVERSAL",
      amount_paise: -original.amount_paise,
      mode: "OTHER", // replaced with the original payment's mode by the database
      reverses_payment_id: original.id,
      note: reason,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "This payment was already reversed." };
    return { error: friendly(error, "Couldn't reverse the payment. Please try again.") };
  }

  await logAudit("payment.reversed", "rental_payment", data.id, {
    rental_order_id: original.rental_order_id,
    reverses_payment_id: original.id,
    amount_paise: -original.amount_paise,
    reason,
  });
  refresh(original.rental_order_id);
  return { done: "Payment reversed." };
}

export async function updateDiscount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant();
  const orderId = orderIdOf(fd);
  if (!orderId.success) return { error: "Booking not found." };
  const type = z.enum(["NONE", "FLAT", "PERCENT"]).safeParse(fd.get("discountType"));
  if (!type.success) return { error: "Choose a discount type." };
  const raw = String(fd.get("discountValue") ?? "").trim();
  let value = 0;
  if (type.data === "FLAT") {
    const v = parseRupeesToPaise(raw);
    if (v === null || v > 1_000_000_000) return { error: "Enter an amount like 500." };
    value = v;
  } else if (type.data === "PERCENT") {
    const v = parsePercentToBasisPoints(raw);
    if (v === null) return { error: "Enter a percentage from 0 to 100." };
    value = v;
  }
  const finalType = value > 0 ? type.data : "NONE";
  const reason = String(fd.get("discountReason") ?? "").trim();
  if (reason.length > 200) return { error: "Keep the reason under 200 characters." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("rental_orders")
    .select("discount_type, discount_value, discount_reason")
    .eq("id", orderId.data)
    .maybeSingle();
  if (!before) return { error: "Booking not found." };

  const { data, error } = await supabase
    .from("rental_orders")
    .update({
      discount_type: finalType,
      discount_value: finalType === "NONE" ? 0 : value,
      discount_reason: finalType === "NONE" ? null : reason || null,
    })
    .eq("id", orderId.data)
    .select("id");
  if (error) return { error: friendly(error, "Couldn't change the discount. Please try again.") };
  if (!data?.length) return { error: "This booking can no longer be changed." };

  await logAudit("booking.discount_changed", "rental_order", orderId.data, {
    from: {
      type: before.discount_type,
      value: before.discount_value,
      reason: before.discount_reason,
    },
    to: { type: finalType, value: finalType === "NONE" ? 0 : value, reason: reason || null },
  });
  refresh(orderId.data);
  return { done: finalType === "NONE" ? "Discount removed." : "Discount updated." };
}

export async function closeBooking(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireActiveTenant();
  const orderId = orderIdOf(fd);
  if (!orderId.success) return { error: "Booking not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_booking", { p_order_id: orderId.data });
  if (error) return { error: friendly(error, "Couldn't close the booking. Please try again.") };
  await logAudit("booking.closed", "rental_order", orderId.data);
  refresh(orderId.data);
  return { done: "Booking closed." };
}

export async function cancelBooking(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireTenantAdmin();
  const orderId = orderIdOf(fd);
  if (!orderId.success) return { error: "Booking not found." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for cancelling." };
  if (reason.length > 200) return { error: "Keep the reason under 200 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_order_id: orderId.data,
    p_reason: reason,
  });
  if (error) return { error: friendly(error, "Couldn't cancel the booking. Please try again.") };
  await logAudit("booking.cancelled", "rental_order", orderId.data, { reason });
  refresh(orderId.data);
  return { done: "Booking cancelled." };
}
