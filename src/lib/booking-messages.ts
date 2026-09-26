import "server-only";
import { amountDueForStoredBooking, estimateStoredBooking } from "./bookings";
import { todayIST } from "./dates";
import { buildMessage, DEFAULT_TEMPLATES, type MessageContext, type MessageType } from "./messages";
import type { SupabaseServerClient } from "./supabase/server";

export type PreparedMessage = {
  type: MessageType;
  whatsapp: string;
  sms: string;
  amountDuePaise: number;
};

export type MessageRecipient = {
  name: string;
  mobile: string;
  whatsappNumber: string | null;
  preferredChannel: "WHATSAPP" | "SMS";
};

/** The business's wording for each message type (defaults where not customised). */
export async function loadTemplates(
  supabase: SupabaseServerClient,
): Promise<Record<MessageType, string>> {
  const { data } = await supabase.from("message_templates").select("message_type, body");
  const templates = { ...DEFAULT_TEMPLATES };
  for (const row of data ?? []) templates[row.message_type] = row.body;
  return templates;
}

export const ORDER_FOR_MESSAGES = `id, booking_number, status, event_start_date, event_start_time,
  expected_return_date, security_deposit_paise, discount_type, discount_value,
  customer:rental_customers (name, mobile, whatsapp_number, preferred_channel),
  lines:rental_order_items (id, quantity, item_name_snapshot, unit_label_snapshot,
    rate_paise_snapshot, rate_unit_snapshot),
  returns:rental_returns (rental_order_item_id, quantity_returned, returned_on),
  payments:rental_payments (amount_paise)` as const;

export type OrderForMessages = {
  booking_number: number;
  status: "ACTIVE" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE" | "CANCELLED";
  event_start_date: string;
  event_start_time: string | null;
  expected_return_date: string;
  security_deposit_paise: number | null;
  discount_type: "NONE" | "FLAT" | "PERCENT";
  discount_value: number;
  customer: {
    name: string;
    mobile: string;
    whatsapp_number: string | null;
    preferred_channel: "WHATSAPP" | "SMS";
  } | null;
  lines: {
    id: string;
    quantity: number;
    item_name_snapshot: string;
    unit_label_snapshot: string;
    rate_paise_snapshot: number;
    rate_unit_snapshot: "PER_DAY" | "PER_EVENT";
  }[];
  returns: { rental_order_item_id: string; quantity_returned: number; returned_on: string }[];
  payments: { amount_paise: number }[];
};

/** Builds messages for an already-loaded booking (no I/O). */
export function buildBookingMessages(
  order: OrderForMessages,
  businessName: string,
  templates: Record<MessageType, string>,
  types: MessageType[],
  asOf: string = todayIST(),
): { recipient: MessageRecipient; messages: PreparedMessage[] } | null {
  if (!order.customer) return null;
  const lines = [...order.lines].sort((a, b) =>
    a.item_name_snapshot.localeCompare(b.item_name_snapshot),
  );
  const estimate = estimateStoredBooking({ ...order, lines });
  const due = amountDueForStoredBooking({ ...order, lines }, asOf);

  const ctx: MessageContext = {
    business: businessName,
    customer: order.customer.name,
    bookingNumber: order.booking_number,
    startDate: order.event_start_date,
    startTime: order.event_start_time ? order.event_start_time.slice(0, 5) : null,
    returnDate: order.expected_return_date,
    plannedDays: estimate.days,
    lines: lines.map((l, i) => ({
      name: l.item_name_snapshot,
      unitLabel: l.unit_label_snapshot,
      quantity: l.quantity,
      ratePaise: l.rate_paise_snapshot,
      rateUnit: l.rate_unit_snapshot,
      amountPaise: estimate.lineAmounts[i],
    })),
    subtotalPaise: estimate.gross,
    discountPaise: estimate.discount,
    totalPaise: estimate.total,
    depositPaise: order.security_deposit_paise,
    asOf,
    chargesSoFarPaise: due.gross,
    discountSoFarPaise: due.discount,
    paidPaise: due.paid,
    amountDuePaise: due.amountDue,
  };

  return {
    recipient: {
      name: order.customer.name,
      mobile: order.customer.mobile,
      whatsappNumber: order.customer.whatsapp_number,
      preferredChannel: order.customer.preferred_channel,
    },
    messages: types.map((type) => ({
      type,
      whatsapp: buildMessage(type, ctx, templates[type], "WHATSAPP"),
      sms: buildMessage(type, ctx, templates[type], "SMS"),
      amountDuePaise: due.amountDue,
    })),
  };
}

/**
 * Loads a booking through the user's session (RLS) and prepares the
 * messages for it, as of today. Null if the booking isn't visible.
 */
export async function prepareBookingMessages(
  supabase: SupabaseServerClient,
  orderId: string,
  businessName: string,
  types: MessageType[],
): Promise<{ recipient: MessageRecipient; messages: PreparedMessage[] } | null> {
  const { data: order } = await supabase
    .from("rental_orders")
    .select(ORDER_FOR_MESSAGES)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  return buildBookingMessages(order, businessName, await loadTemplates(supabase), types);
}
