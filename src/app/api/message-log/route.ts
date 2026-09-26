import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { tenantAccess } from "@/lib/auth/access";
import { getSessionProfile } from "@/lib/auth/session";
import { amountDueForStoredBooking } from "@/lib/bookings";
import { todayIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// Records a tap on Send on WhatsApp / Send SMS / Copy. Called with
// `keepalive` so it completes even while the phone switches apps.
const schema = z.object({
  orderId: z.uuid(),
  type: z.enum(["BOOKING_CONFIRMATION", "AMOUNT_DUE", "RETURN_CONFIRMATION"]),
  channel: z.enum(["WHATSAPP", "SMS", "COPY"]),
  body: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (
    !profile ||
    profile.kind !== "tenant" ||
    profile.status !== "ACTIVE" ||
    !profile.tenant ||
    !tenantAccess(profile.tenant).ok ||
    profile.mustChangePassword
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { orderId, type, channel, body } = parsed.data;

  const supabase = await createClient();
  // The recipient and amount come from the database, not the request.
  const { data: order } = await supabase
    .from("rental_orders")
    .select(
      `status, event_start_date, expected_return_date, discount_type, discount_value,
       customer:rental_customers (mobile, whatsapp_number),
       lines:rental_order_items (id, quantity, rate_paise_snapshot, rate_unit_snapshot),
       returns:rental_returns (rental_order_item_id, quantity_returned, returned_on),
       payments:rental_payments (amount_paise)`,
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toNumber =
    channel === "COPY"
      ? null
      : channel === "WHATSAPP"
        ? order.customer.whatsapp_number
        : order.customer.mobile;
  if (channel === "WHATSAPP" && !toNumber) {
    return NextResponse.json({ error: "Customer is not on WhatsApp" }, { status: 400 });
  }
  const due = amountDueForStoredBooking(order, todayIST());

  const { data: row, error } = await supabase
    .from("message_log")
    .insert({
      rental_order_id: orderId,
      message_type: type,
      channel,
      to_number: toNumber,
      body_snapshot: body,
      amount_due_snapshot_paise: due.amountDue,
    })
    .select("id, opened_at")
    .single();
  if (error) {
    console.error("message_log insert failed:", error.code, error.message);
    return NextResponse.json({ error: "Could not log" }, { status: 500 });
  }

  await logAudit("message.opened", "rental_order", orderId, {
    message_log_id: row.id,
    type,
    channel,
  });
  return NextResponse.json({ id: row.id, openedAt: row.opened_at });
}
