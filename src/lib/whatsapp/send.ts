import "server-only";
import { requireActiveTenant } from "@/lib/auth/guards";
import {
  buildBookingMessages,
  ORDER_FOR_MESSAGES,
  type OrderForMessages,
} from "@/lib/booking-messages";
import { todayIST } from "@/lib/dates";
import { DEFAULT_TEMPLATES, type MessageType } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendTemplate } from "./cloud-api";
import { API_TEMPLATES, renderTemplate, TEMPLATE_LANGUAGE } from "./templates";

export type ApiSendResult = { ok: true } | { ok: false; error: string; skipped?: boolean };

export type Blocker = "not_connected" | "no_whatsapp" | "no_consent";

/** Why a booking can't be sent automatically right now (null = it can). */
export function autoSendBlocker(
  connection: { status: string } | null,
  recipient: { whatsappNumber: string | null; whatsappOptIn: boolean },
): Blocker | null {
  if (!connection || connection.status !== "CONNECTED") return "not_connected";
  if (!recipient.whatsappNumber) return "no_whatsapp";
  if (!recipient.whatsappOptIn) return "no_consent";
  return null;
}

const BLOCKER_TEXT: Record<Blocker, string> = {
  not_connected: "WhatsApp isn't connected for this business.",
  no_whatsapp: "This customer has no WhatsApp number.",
  no_consent: "This customer hasn't agreed to receive WhatsApp messages.",
};

/**
 * Sends one booking message through a business's own WhatsApp number and
 * logs it (server-side). No session: callers must have authorised the
 * business already — the button via requireActiveTenant({ type: "TENT_HOUSE" }) + RLS, the 9 PM
 * job by only ever passing a booking of the business it is processing.
 * With `reminderDate`, the log row is claimed first so a booking can get
 * at most one evening reminder per day.
 */
export async function deliver({
  tenantId,
  businessName,
  order,
  orderId,
  type,
  sentBy,
  reminderDate,
}: {
  tenantId: string;
  businessName: string;
  order: OrderForMessages;
  orderId: string;
  type: MessageType;
  sentBy: string | null;
  reminderDate?: string;
}): Promise<ApiSendResult> {
  const admin = createAdminClient();
  const [{ data: tenant }, { data: connection }] = await Promise.all([
    admin.from("tenants").select("whatsapp_addon").eq("id", tenantId).maybeSingle(),
    admin
      .from("whatsapp_connections")
      .select("phone_number_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  if (!tenant?.whatsapp_addon)
    return {
      ok: false,
      error: "Automatic WhatsApp isn't switched on for this business.",
      skipped: true,
    };
  const asOf = reminderDate ?? todayIST();
  const prepared = buildBookingMessages(order, businessName, DEFAULT_TEMPLATES, [type], asOf);
  if (!prepared) return { ok: false, error: "Booking not found." };
  const blocker = autoSendBlocker(connection, prepared.recipient);
  if (blocker) return { ok: false, error: BLOCKER_TEXT[blocker], skipped: true };

  const def = API_TEMPLATES[type];
  const params = def.params(prepared.context);
  const to = prepared.recipient.whatsappNumber!;
  const row = {
    tenant_id: tenantId,
    rental_order_id: orderId,
    message_type: type,
    channel: "WHATSAPP_API" as const,
    to_number: to,
    body_snapshot: renderTemplate(def.text, params),
    amount_due_snapshot_paise: prepared.messages[0].amountDuePaise,
    template_name: def.name,
    sent_by: sentBy,
    reminder_date: reminderDate ?? null,
  };

  // Evening reminder: claim today's slot first (unique per booking per day).
  let claimedId: number | null = null;
  if (reminderDate) {
    const { data: claimed, error } = await admin
      .from("message_log")
      .insert({ ...row, delivery_status: "PENDING" })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Already reminded today.", skipped: true };
      return { ok: false, error: `Couldn't record the reminder: ${error.message}` };
    }
    claimedId = claimed.id;
  }

  const { data: token } = await admin.rpc("wa_access_token", { p_tenant_id: tenantId });
  const result = token
    ? await sendTemplate({
        phoneNumberId: connection!.phone_number_id,
        token,
        to,
        template: def.name,
        language: TEMPLATE_LANGUAGE,
        params,
      })
    : ({ ok: false, code: "no_token", message: "No access token saved" } as const);

  const outcome = {
    provider_message_id: result.ok ? result.messageId : null,
    delivery_status: result.ok ? ("SENT" as const) : ("FAILED" as const),
    status_updated_at: new Date().toISOString(),
    error_code: result.ok ? null : result.code,
    error_message: result.ok ? null : result.message,
  };
  const { error: logError } = claimedId
    ? await admin.from("message_log").update(outcome).eq("id", claimedId)
    : await admin.from("message_log").insert({ ...row, ...outcome });
  if (logError) console.error("message_log write (API) failed:", logError.message);

  await admin.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: sentBy,
    action: reminderDate ? "message.reminder_sent" : "message.sent_api",
    target_type: "rental_order",
    target_id: orderId,
    metadata: {
      type,
      template: def.name,
      ok: result.ok,
      provider_message_id: result.ok ? result.messageId : null,
      error_code: result.ok ? null : result.code,
      ...(reminderDate ? { reminder_date: reminderDate } : {}),
    },
  });

  return result.ok
    ? { ok: true }
    : { ok: false, error: `WhatsApp didn't accept it: ${result.message}` };
}

/** "Send automatically" button: the booking is loaded through the user's session (RLS). */
export async function sendBookingViaApi(
  orderId: string,
  type: MessageType,
): Promise<ApiSendResult> {
  const member = await requireActiveTenant({ type: "TENT_HOUSE" });
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("rental_orders")
    .select(ORDER_FOR_MESSAGES)
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.customer) return { ok: false, error: "Booking not found." };
  return deliver({
    tenantId: member.tenantId,
    businessName: member.tenant.name,
    order,
    orderId,
    type,
    sentBy: member.userId,
  });
}

/**
 * Right after a booking is saved: sends the booking details automatically
 * if the business is connected, the owner left it switched on, and the
 * customer agreed. Returns null when no attempt was made.
 */
export async function autoSendBookingDetails(orderId: string): Promise<ApiSendResult | null> {
  const member = await requireActiveTenant({ type: "TENT_HOUSE" });
  if (!member.tenant.whatsapp_addon) return null;
  const supabase = await createClient();
  const [{ data: connection }, { data: settings }] = await Promise.all([
    supabase.from("whatsapp_connections").select("status").maybeSingle(),
    supabase.from("whatsapp_settings").select("auto_booking_details").maybeSingle(),
  ]);
  if (connection?.status !== "CONNECTED" || settings?.auto_booking_details === false) return null;
  const result = await sendBookingViaApi(orderId, "BOOKING_CONFIRMATION");
  if (!result.ok && result.skipped) return null; // e.g. customer didn't agree
  return result;
}
