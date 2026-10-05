"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant } from "@/lib/auth/guards";
import { parseCustomer, readCustomerForm, type CustomerFormField } from "@/lib/customers";
import {
  findDuplicateCustomer,
  insertCustomer,
  type DuplicateCustomer,
} from "@/lib/customers-server";
import { isIsoDate } from "@/lib/dates";
import { parseRupeesToPaise } from "@/lib/money";
import { estimateBooking, parsePercentToBasisPoints, type DiscountType } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { autoSendBookingDetails } from "@/lib/whatsapp/send";

type BookingField =
  | "customer"
  | "startDate"
  | "startTime"
  | "returnDate"
  | "lines"
  | "deposit"
  | "discount"
  | "discountReason"
  | "notes";

export type StockWarning = {
  itemId: string;
  name: string;
  requested: number;
  free: number;
  owned: number;
  committed: number;
};

export type BookingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<BookingField, string>>;
  customerErrors?: Partial<Record<CustomerFormField, string>>;
  duplicate?: DuplicateCustomer;
  stockWarnings?: StockWarning[];
  /** Set when a new customer was saved but the booking wasn't. */
  createdCustomerId?: string;
};

const linesSchema = z
  .array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1).max(1_000_000) }))
  .min(1);

function parseLines(raw: unknown) {
  try {
    const parsed = linesSchema.safeParse(JSON.parse(String(raw ?? "[]")));
    if (!parsed.success) return null;
    // Merge duplicate items.
    const merged = new Map<string, number>();
    for (const l of parsed.data) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.quantity);
    return [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
  } catch {
    return null;
  }
}

export async function createBooking(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  await requireActiveTenant({ type: "TENT_HOUSE" });
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const fieldErrors: BookingFormState["fieldErrors"] = {};

  // --- Customer -----------------------------------------------------------
  const isNewCustomer = get("customerMode") === "new";
  let customerId: string | null = null;
  const newCustomer = isNewCustomer ? parseCustomer(readCustomerForm(formData, "c_")) : null;
  if (isNewCustomer) {
    if (newCustomer && !newCustomer.ok) {
      return { customerErrors: newCustomer.fieldErrors, error: "Check the customer details." };
    }
  } else {
    const id = z.uuid().safeParse(get("customerId"));
    if (id.success) customerId = id.data;
    else fieldErrors.customer = "Choose a customer";
  }

  // --- Dates ----------------------------------------------------------------
  const startDate = get("startDate");
  const returnDate = get("returnDate");
  const startTime = get("startTime");
  if (!isIsoDate(startDate)) fieldErrors.startDate = "Choose the start date";
  if (!isIsoDate(returnDate)) fieldErrors.returnDate = "Choose the return date";
  else if (isIsoDate(startDate) && returnDate < startDate) {
    fieldErrors.returnDate = "Return date can't be before the start date";
  }
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    fieldErrors.startTime = "Enter a valid time";
  }

  // --- Items ----------------------------------------------------------------
  const lines = parseLines(formData.get("lines"));
  if (!lines) fieldErrors.lines = "Add at least one item";

  // --- Money ----------------------------------------------------------------
  const depositRaw = get("deposit");
  const deposit = depositRaw ? parseRupeesToPaise(depositRaw) : null;
  if (depositRaw && deposit === null) fieldErrors.deposit = "Enter an amount like 2000";

  let discountType: DiscountType = "NONE";
  let discountValue = 0;
  const rawDiscountType = get("discountType");
  const discountRaw = get("discountValue");
  if ((rawDiscountType === "FLAT" || rawDiscountType === "PERCENT") && discountRaw) {
    const v =
      rawDiscountType === "FLAT"
        ? parseRupeesToPaise(discountRaw)
        : parsePercentToBasisPoints(discountRaw);
    if (v === null || (rawDiscountType === "FLAT" && v > 1_000_000_000)) {
      fieldErrors.discount =
        rawDiscountType === "FLAT"
          ? "Enter an amount like 500"
          : "Enter a percentage from 0 to 100";
    } else if (v > 0) {
      discountType = rawDiscountType;
      discountValue = v;
    }
  }
  const discountReason = get("discountReason");
  if (discountReason.length > 200)
    fieldErrors.discountReason = "Keep the reason under 200 characters";
  const notes = get("notes");
  if (notes.length > 1000) fieldErrors.notes = "Keep notes under 1000 characters";

  if (Object.keys(fieldErrors).length || !lines) return { fieldErrors };

  const supabase = await createClient();

  // --- Items exist in THIS business (RLS) and stock check --------------------
  const { data: items } = await supabase
    .from("rental_items")
    .select("id, name, total_quantity_owned, active, rate_paise, rate_unit")
    .in(
      "id",
      lines.map((l) => l.itemId),
    );
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const missing = lines.filter((l) => !byId.get(l.itemId)?.active);
  if (missing.length) {
    return {
      fieldErrors: { lines: "Some items aren't available any more. Refresh and try again." },
    };
  }

  if (formData.get("confirmStock") !== "1") {
    const { data: commitments } = await supabase.rpc("item_commitments", {
      p_start: startDate,
      p_end: returnDate,
    });
    const committed = new Map((commitments ?? []).map((c) => [c.rental_item_id, c.committed]));
    const warnings: StockWarning[] = [];
    for (const l of lines) {
      const item = byId.get(l.itemId)!;
      const used = committed.get(l.itemId) ?? 0;
      const free = Math.max(0, item.total_quantity_owned - used);
      if (l.quantity > free) {
        warnings.push({
          itemId: l.itemId,
          name: item.name,
          requested: l.quantity,
          free,
          owned: item.total_quantity_owned,
          committed: used,
        });
      }
    }
    if (warnings.length) return { stockWarnings: warnings };
  }

  // --- New customer (after all booking checks pass) ---------------------------
  if (isNewCustomer && newCustomer?.ok) {
    if (formData.get("confirmDuplicate") !== "1") {
      const duplicate = await findDuplicateCustomer(supabase, newCustomer.row);
      if (duplicate) return { duplicate };
    }
    customerId = await insertCustomer(supabase, newCustomer.row);
    if (!customerId) return { error: "Couldn't save the customer. Please try again." };
  }

  // --- Create booking + lines atomically (rates snapshotted in the database) -
  const { data: orderId, error } = await supabase.rpc("create_booking", {
    p_customer_id: customerId!,
    p_event_start_date: startDate,
    p_expected_return_date: returnDate,
    p_lines: lines.map((l) => ({ item_id: l.itemId, quantity: l.quantity })),
    ...(startTime ? { p_event_start_time: startTime } : {}),
    ...(deposit !== null ? { p_security_deposit_paise: deposit } : {}),
    p_discount_type: discountType,
    p_discount_value: discountValue,
    ...(discountReason ? { p_discount_reason: discountReason } : {}),
    ...(notes ? { p_notes: notes } : {}),
  });
  const createdCustomerId = isNewCustomer ? customerId! : undefined;
  if (error || !orderId) {
    if (error?.code === "23503") {
      return {
        createdCustomerId,
        error: "That customer or an item wasn't found. Refresh and try again.",
      };
    }
    if (error?.code === "23514" && /deactivated/.test(error.message)) {
      return { createdCustomerId, fieldErrors: { lines: error.message } };
    }
    console.error("create_booking failed:", error?.code, error?.message);
    return { createdCustomerId, error: "Couldn't save the booking. Please try again." };
  }

  const { data: order } = await supabase
    .from("rental_orders")
    .select("booking_number")
    .eq("id", orderId)
    .single();
  const estimate = estimateBooking(
    lines.map((l) => {
      const i = byId.get(l.itemId)!;
      return { ratePaise: i.rate_paise, rateUnit: i.rate_unit, quantity: l.quantity };
    }),
    startDate,
    returnDate,
    { type: discountType, value: discountValue },
  );
  await logAudit("booking.created", "rental_order", orderId, {
    booking_number: order?.booking_number ?? null,
    customer_id: customerId,
    lines: lines.length,
    discount_type: discountType,
    discount_value: discountValue,
    discount_reason: discountReason || null,
    estimated_total_paise: estimate.total,
  });

  // Booking details go out automatically when WhatsApp is connected and the
  // customer agreed. A failure never undoes the booking.
  const auto = await autoSendBookingDetails(orderId).catch((e) => {
    console.error("auto booking details failed:", (e as Error).message);
    return { ok: false as const, error: "error" };
  });
  revalidatePath("/bookings");
  redirect(`/bookings/${orderId}?created=1${auto ? (auto.ok ? "&wa=sent" : "&wa=failed") : ""}`);
}
