"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeSignupCode,
  fetchDisplayNumber,
  subscribeAppToWaba,
} from "@/lib/whatsapp/cloud-api";
import {
  disconnectConnection,
  saveConnection,
  sendTestMessage,
  type ConnectionResult,
} from "@/lib/whatsapp/connection";

// Owner's own WhatsApp connection. The business is ALWAYS the signed-in
// owner's (requireTenantAdmin); any tenant id in the form is ignored.

const ADDON_OFF: ConnectionResult = {
  error: "Automatic WhatsApp isn't switched on for your business. Ask RentCorp.",
};

/** Owner of a business that has the WhatsApp add-on, or null. */
async function addonOwner() {
  const owner = await requireTenantAdmin();
  return owner.tenant.whatsapp_addon ? owner : null;
}

function done() {
  revalidatePath("/settings/whatsapp");
  revalidatePath("/settings");
}

export async function ownerSaveConnection(
  _prev: ConnectionResult,
  fd: FormData,
): Promise<ConnectionResult> {
  const owner = await addonOwner();
  if (!owner) return ADDON_OFF;
  const result = await saveConnection({
    tenantId: owner.tenantId,
    actorId: owner.userId,
    wabaId: String(fd.get("wabaId") ?? ""),
    phoneNumberId: String(fd.get("phoneNumberId") ?? ""),
    display: String(fd.get("displayNumber") ?? ""),
    token: String(fd.get("accessToken") ?? ""),
    via: "owner_form",
  });
  done();
  return result;
}

export async function ownerDisconnect(): Promise<ConnectionResult> {
  const owner = await addonOwner();
  if (!owner) return ADDON_OFF;
  const result = await disconnectConnection(owner.tenantId, owner.userId);
  done();
  return result;
}

export async function ownerTestMessage(
  _prev: ConnectionResult,
  fd: FormData,
): Promise<ConnectionResult> {
  const owner = await addonOwner();
  if (!owner) return ADDON_OFF;
  return sendTestMessage(owner.tenantId, owner.userId, String(fd.get("testNumber") ?? ""));
}

export async function saveAutomationSettings(
  _prev: ConnectionResult,
  fd: FormData,
): Promise<ConnectionResult> {
  if (!(await addonOwner())) return ADDON_OFF;
  const next = {
    auto_booking_details: fd.get("autoBookingDetails") === "on",
    evening_reminder: fd.get("eveningReminder") === "on",
  };
  const supabase = await createClient();
  // tenant_id comes from the session (database default + trigger).
  const { error } = await supabase
    .from("whatsapp_settings")
    .upsert(next, { onConflict: "tenant_id" });
  if (error) return { error: "Couldn't save. Please try again." };
  await logAudit("whatsapp.settings_changed", "whatsapp_settings", null, next);
  done();
  return { done: "Saved." };
}

const signupSchema = z.object({
  code: z.string().min(4).max(2000),
  wabaId: z.string().regex(/^\d{5,30}$/),
  phoneNumberId: z.string().regex(/^\d{5,30}$/),
});

/** Finishes Meta's Embedded Signup: code → token → subscribe → save. */
export async function completeEmbeddedSignup(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<ConnectionResult> {
  const owner = await addonOwner();
  if (!owner) return ADDON_OFF;
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Meta didn't return the details we need. Please try again." };
  const exchanged = await exchangeSignupCode(parsed.data.code);
  if (!exchanged.ok) return { error: `Meta sign-up failed: ${exchanged.message}` };
  const subscribed = await subscribeAppToWaba(parsed.data.wabaId, exchanged.token);
  if (!subscribed.ok)
    return { error: `Couldn't link your WhatsApp account: ${subscribed.message}` };
  const display =
    (await fetchDisplayNumber(parsed.data.phoneNumberId, exchanged.token)) ?? "WhatsApp number";
  const result = await saveConnection({
    tenantId: owner.tenantId,
    actorId: owner.userId,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId,
    display,
    token: exchanged.token,
    via: "embedded_signup",
  });
  done();
  return result;
}
