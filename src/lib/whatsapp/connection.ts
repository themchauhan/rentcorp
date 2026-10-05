import "server-only";
import { normalizeIndianMobile } from "@/lib/auth/mobile";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { sendTemplate } from "./cloud-api";

// Connecting a business's WhatsApp number. Shared by the super admin's
// business page and the owner's own Settings → WhatsApp page. Callers pass
// the tenant they have authorised (owner: from the session only). The
// access token is write-only: it goes straight into Supabase Vault.

export type ConnectionResult = { error?: string; done?: string };

async function audit(
  tenantId: string,
  actorId: string | null,
  action: string,
  metadata: { [key: string]: Json | undefined },
) {
  await createAdminClient().from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: actorId,
    action,
    target_type: "tenant",
    target_id: tenantId,
    metadata,
  });
}

export async function saveConnection(input: {
  tenantId: string;
  actorId: string;
  wabaId: string;
  phoneNumberId: string;
  display: string;
  token: string;
  via: "super_admin" | "owner_form" | "embedded_signup";
}): Promise<ConnectionResult> {
  const wabaId = input.wabaId.replace(/\s/g, "");
  const phoneNumberId = input.phoneNumberId.replace(/\s/g, "");
  const display = input.display.trim();
  const token = input.token.trim();
  if (!/^\d{5,30}$/.test(wabaId))
    return { error: "WhatsApp Business Account ID should be digits only." };
  if (!/^\d{5,30}$/.test(phoneNumberId)) return { error: "Phone number ID should be digits only." };
  if (display.length < 5 || display.length > 30)
    return { error: "Enter the WhatsApp number shown to customers." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("whatsapp_connections")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!existing && token.length < 20) return { error: "Paste the access token to connect." };

  const row = {
    tenant_id: input.tenantId,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone_number: display,
    status: "CONNECTED" as const,
    connected_by: input.actorId,
  };
  const { error } = existing
    ? await admin.from("whatsapp_connections").update(row).eq("tenant_id", input.tenantId)
    : await admin.from("whatsapp_connections").insert(row);
  if (error) {
    if (error.code === "23505")
      return { error: "That phone number is already connected to another business." };
    console.error("saveConnection failed:", error.message);
    return { error: "Couldn't save the connection." };
  }
  if (token) {
    const { error: tokenError } = await admin.rpc("wa_set_credentials", {
      p_tenant_id: input.tenantId,
      p_access_token: token,
    });
    if (tokenError)
      return { error: "Details saved, but the token wasn't accepted. Paste it again." };
  }
  await audit(input.tenantId, input.actorId, "whatsapp.connected", {
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display,
    token_updated: Boolean(token),
    via: input.via,
  });
  return { done: token ? "WhatsApp connected." : "Details updated (token unchanged)." };
}

export async function disconnectConnection(
  tenantId: string,
  actorId: string,
): Promise<ConnectionResult> {
  const { error } = await createAdminClient()
    .from("whatsapp_connections")
    .update({ status: "DISCONNECTED" })
    .eq("tenant_id", tenantId);
  if (error) return { error: "Couldn't disconnect." };
  await audit(tenantId, actorId, "whatsapp.disconnected", {});
  return {
    done: "WhatsApp disconnected. Automatic messages are off; the one-tap buttons still work.",
  };
}

/** Sends Meta's built-in hello_world template to check the connection works. */
export async function sendTestMessage(
  tenantId: string,
  actorId: string,
  toRaw: string,
): Promise<ConnectionResult> {
  const to = normalizeIndianMobile(toRaw);
  if (!to) return { error: "Enter a valid 10-digit mobile number." };
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("whatsapp_connections")
    .select("phone_number_id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!conn || conn.status !== "CONNECTED") return { error: "Connect WhatsApp first." };
  const { data: token } = await admin.rpc("wa_access_token", { p_tenant_id: tenantId });
  if (!token) return { error: "No access token saved." };
  const result = await sendTemplate({
    phoneNumberId: conn.phone_number_id,
    token,
    to,
    template: "hello_world",
    language: "en_US",
    params: [],
  });
  await audit(tenantId, actorId, "whatsapp.test_sent", { ok: result.ok, to });
  return result.ok
    ? { done: `Test message sent to ${to}. Check that phone's WhatsApp.` }
    : { error: `WhatsApp didn't accept it: ${result.message}` };
}
