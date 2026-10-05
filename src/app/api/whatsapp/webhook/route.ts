import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOptOut,
  parseWebhook,
  shouldApplyStatus,
  verifySignature,
} from "@/lib/whatsapp/protocol";

// Meta's WhatsApp webhook. Public (Meta calls it), so every POST must carry
// a valid X-Hub-Signature-256 made with our app secret. Each update is
// matched to a business by its phone_number_id and only touches that
// business's rows.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === expected
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error("WhatsApp webhook: WHATSAPP_APP_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { statuses, inbound } = parseWebhook(payload);
  const admin = createAdminClient();
  const tenantByPhone = new Map<string, string | null>();
  async function tenantFor(phoneNumberId: string) {
    if (!tenantByPhone.has(phoneNumberId)) {
      const { data } = await admin
        .from("whatsapp_connections")
        .select("tenant_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      tenantByPhone.set(phoneNumberId, data?.tenant_id ?? null);
    }
    return tenantByPhone.get(phoneNumberId)!;
  }

  for (const s of statuses) {
    const tenantId = await tenantFor(s.phoneNumberId);
    if (!tenantId) continue;
    const { data: row } = await admin
      .from("message_log")
      .select("id, delivery_status")
      .eq("tenant_id", tenantId)
      .eq("provider_message_id", s.messageId)
      .maybeSingle();
    if (!row || !shouldApplyStatus(row.delivery_status, s.status)) continue;
    await admin
      .from("message_log")
      .update({
        delivery_status: s.status,
        status_updated_at: new Date().toISOString(),
        error_code: s.errorCode,
        error_message: s.errorMessage,
      })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
  }

  for (const m of inbound) {
    if (!isOptOut(m.text)) continue;
    const tenantId = await tenantFor(m.phoneNumberId);
    const mobile = m.from.replace(/^91/, "");
    if (!tenantId || !/^[6-9]\d{9}$/.test(mobile)) continue;
    const { data: customers } = await admin
      .from("rental_customers")
      .update({ whatsapp_opt_in: false })
      .eq("tenant_id", tenantId)
      .eq("whatsapp_number", mobile)
      .eq("whatsapp_opt_in", true)
      .select("id");
    for (const c of customers ?? []) {
      await admin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "customer.whatsapp_opted_out",
        target_type: "rental_customer",
        target_id: c.id,
        metadata: { via: "whatsapp_reply" },
      });
    }
  }

  // Always 200 for a valid request, so Meta doesn't keep retrying.
  return NextResponse.json({ ok: true });
}
