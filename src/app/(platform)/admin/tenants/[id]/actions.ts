"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { isIsoDate } from "@/lib/dates";
import { parseRupeesToPaise } from "@/lib/money";
import { endOfIstDay, extendedEnd, istDateOf } from "@/lib/subscriptions";
import { removeBusinessFiles } from "@/lib/storage-cleanup";
import { createClient } from "@/lib/supabase/server";
import { disconnectConnection, saveConnection, sendTestMessage } from "@/lib/whatsapp/connection";

export type AdminActionState = { error?: string; done?: string };

const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"] as const;
const tenantIdOf = (fd: FormData) => z.uuid().safeParse(fd.get("tenantId"));

async function loadTenant(id: string) {
  const supabase = await createClient();
  // Platform admins can read every tenant (RLS).
  const { data } = await supabase
    .from("tenants")
    .select("id, status, plan, trial_ends_at, subscription_ends_at")
    .eq("id", id)
    .maybeSingle();
  return { supabase, tenant: data };
}

function refresh(id: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${id}`);
}

export async function updateSubscription(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const status = z.enum(STATUSES).safeParse(fd.get("status"));
  if (!status.success) return { error: "Choose a status." };
  const plan = String(fd.get("plan") ?? "")
    .trim()
    .toUpperCase();
  if (!plan || plan.length > 40) return { error: "Enter a plan name (e.g. MONTHLY)." };
  const trialEnd = String(fd.get("trialEnds") ?? "");
  const subEnd = String(fd.get("subscriptionEnds") ?? "");
  if (trialEnd && !isIsoDate(trialEnd)) return { error: "Trial end date is not valid." };
  if (subEnd && !isIsoDate(subEnd)) return { error: "Subscription end date is not valid." };

  const { supabase, tenant } = await loadTenant(id.data);
  if (!tenant) return { error: "Business not found." };
  const next = {
    status: status.data,
    plan,
    trial_ends_at: trialEnd ? endOfIstDay(trialEnd) : null,
    subscription_ends_at: subEnd ? endOfIstDay(subEnd) : null,
  };
  const { data, error } = await supabase
    .from("tenants")
    .update(next)
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save. Please try again." };

  const changes = {
    status: [tenant.status, next.status],
    plan: [tenant.plan, next.plan],
    trial_ends: [istDateOf(tenant.trial_ends_at), trialEnd || null],
    subscription_ends: [istDateOf(tenant.subscription_ends_at), subEnd || null],
  };
  await logAudit(
    "tenant.subscription_updated",
    "tenant",
    id.data,
    Object.fromEntries(
      Object.entries(changes)
        .filter(([, [a, b]]) => a !== b)
        .map(([k, [from, to]]) => [k, { from, to }]),
    ),
    { tenantId: id.data },
  );
  refresh(id.data);
  return { done: "Saved." };
}

export async function extendSubscription(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const months = Number(fd.get("months"));
  if (![1, 3, 12].includes(months)) return { error: "Choose a period." };

  const { supabase, tenant } = await loadTenant(id.data);
  if (!tenant) return { error: "Business not found." };
  const end = extendedEnd(tenant.subscription_ends_at, months);
  const { data, error } = await supabase
    .from("tenants")
    .update({ status: "ACTIVE", subscription_ends_at: endOfIstDay(end) })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't extend. Please try again." };

  await logAudit(
    "tenant.subscription_extended",
    "tenant",
    id.data,
    { months, from: istDateOf(tenant.subscription_ends_at), to: end, status_from: tenant.status },
    { tenantId: id.data },
  );
  refresh(id.data);
  return { done: `Active until ${end}.` };
}

const METHODS = ["UPI", "BANK_TRANSFER", "CASH", "OTHER"] as const;

export async function recordSubscriptionPayment(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const amount = parseRupeesToPaise(String(fd.get("amount") ?? ""));
  if (!amount) return { error: "Enter the amount received." };
  const method = z.enum(METHODS).safeParse(fd.get("method"));
  if (!method.success) return { error: "Choose how it was paid." };
  const paymentDate = String(fd.get("paymentDate") ?? "");
  const periodStart = String(fd.get("periodStart") ?? "");
  const periodEnd = String(fd.get("periodEnd") ?? "");
  if (![paymentDate, periodStart, periodEnd].every(isIsoDate))
    return { error: "Fill in all the dates." };
  if (periodEnd < periodStart) return { error: "Period end can't be before its start." };
  const reference = String(fd.get("reference") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  if (reference.length > 100 || notes.length > 500)
    return { error: "Reference or notes are too long." };
  const extend = fd.get("extend") === "on";

  const { supabase, tenant } = await loadTenant(id.data);
  if (!tenant) return { error: "Business not found." };
  const { data: payment, error } = await supabase
    .from("subscription_payments")
    .insert({
      tenant_id: id.data,
      amount_paise: amount,
      payment_date: paymentDate,
      payment_method: method.data,
      reference_number: reference || null,
      period_start: periodStart,
      period_end: periodEnd,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't record the payment. Please try again." };

  await logAudit(
    "subscription_payment.recorded",
    "subscription_payment",
    payment.id,
    { amount_paise: amount, method: method.data, period_start: periodStart, period_end: periodEnd },
    { tenantId: id.data },
  );

  if (extend) {
    const current = istDateOf(tenant.subscription_ends_at);
    const newEnd = current && current > periodEnd ? current : periodEnd;
    const { error: upErr } = await supabase
      .from("tenants")
      .update({ status: "ACTIVE", subscription_ends_at: endOfIstDay(newEnd) })
      .eq("id", id.data);
    if (upErr) return { error: "Payment saved, but the subscription wasn't extended. Try again." };
    await logAudit(
      "tenant.subscription_extended",
      "tenant",
      id.data,
      { from: current, to: newEnd, status_from: tenant.status, via_payment: payment.id },
      { tenantId: id.data },
    );
  }
  refresh(id.data);
  return { done: extend ? `Payment recorded. Active until ${periodEnd}.` : "Payment recorded." };
}

export async function setTestFlag(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const isTest = fd.get("isTest") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update({ is_test: isTest })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update. Please try again." };
  await logAudit(
    "tenant.test_flag_changed",
    "tenant",
    id.data,
    { is_test: isTest },
    { tenantId: id.data },
  );
  refresh(id.data);
  return { done: isTest ? "Marked as a test business." : "No longer a test business." };
}

export async function setWhatsAppAddon(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const on = fd.get("addon") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update({ whatsapp_addon: on })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update. Please try again." };
  await logAudit(
    "tenant.whatsapp_addon_changed",
    "tenant",
    id.data,
    { whatsapp_addon: on },
    { tenantId: id.data },
  );
  refresh(id.data);
  return {
    done: on
      ? "WhatsApp automation switched on. The owner now sees Settings → WhatsApp."
      : "WhatsApp automation switched off. Only the one-tap buttons show.",
  };
}

/**
 * Permanently deletes a business marked as Test, with everything in it and
 * its staff logins. The database function re-checks every rule.
 */
export async function deleteTestBusiness(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const confirm = String(fd.get("confirmName") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_test_business", {
    p_tenant_id: id.data,
    p_confirm_name: confirm,
  });
  if (error) {
    if (["22023", "23514", "42501", "23503"].includes(error.code ?? ""))
      return { error: error.message };
    console.error("delete_test_business failed:", error.code, error.message);
    return { error: "Couldn't delete. Nothing was changed." };
  }
  // The rows are gone; now its private files (ID photos, agreements).
  try {
    await removeBusinessFiles(id.data);
  } catch (e) {
    // Harmless leftovers (nobody can reach them); logged for a manual sweep.
    console.error("removeBusinessFiles failed:", id.data, (e as Error).message);
  }
  revalidatePath("/admin");
  redirect(`/admin?deleted=${encodeURIComponent(confirm)}`);
}

// ---------------------------------------------------------------------------
// WhatsApp connection (shared logic in src/lib/whatsapp/connection.ts)
// ---------------------------------------------------------------------------

export async function saveWhatsAppConnection(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  const me = await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const result = await saveConnection({
    tenantId: id.data,
    actorId: me.userId,
    wabaId: String(fd.get("wabaId") ?? ""),
    phoneNumberId: String(fd.get("phoneNumberId") ?? ""),
    display: String(fd.get("displayNumber") ?? ""),
    token: String(fd.get("accessToken") ?? ""),
    via: "super_admin",
  });
  refresh(id.data);
  return result;
}

export async function disconnectWhatsApp(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  const me = await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  const result = await disconnectConnection(id.data, me.userId);
  refresh(id.data);
  return result;
}

export async function sendWhatsAppTest(
  _prev: AdminActionState,
  fd: FormData,
): Promise<AdminActionState> {
  const me = await requireRole("SUPER_ADMIN");
  const id = tenantIdOf(fd);
  if (!id.success) return { error: "Business not found." };
  return sendTestMessage(id.data, me.userId, String(fd.get("testNumber") ?? ""));
}
