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
    .select(
      `booking_number, status, event_start_date, event_start_time, expected_return_date,
       security_deposit_paise, discount_type, discount_value,
       customer:rental_customers (name, mobile, whatsapp_number, preferred_channel),
       lines:rental_order_items (id, quantity, item_name_snapshot, unit_label_snapshot,
         rate_paise_snapshot, rate_unit_snapshot)`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.customer) return null;

  const lines = [...order.lines].sort((a, b) =>
    a.item_name_snapshot.localeCompare(b.item_name_snapshot),
  );
  const asOf = todayIST();
  const estimate = estimateStoredBooking({ ...order, lines });
  const due = amountDueForStoredBooking({ ...order, lines }, asOf);
  const templates = await loadTemplates(supabase);

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
