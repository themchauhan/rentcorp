import "server-only";
import { tenantAccess } from "@/lib/auth/access";
import { ORDER_FOR_MESSAGES } from "@/lib/booking-messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { eveningMessageFor, type EveningOrder } from "./evening";
import { deliver } from "./send";

export type EveningSummary = {
  runDate: string;
  businesses: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: { tenantId: string; orderId?: string; error: string }[];
};

/**
 * The 9 PM job: for every business with the WhatsApp add-on, WhatsApp connected, access, and the
 * evening reminder switched on, send each customer with money due one
 * message for today. Runs with the secret key (it spans businesses), but
 * every query and send is scoped to the one business being processed, and
 * one business's failure never stops the others.
 */
export async function runEveningReminders(runDate: string): Promise<EveningSummary> {
  const admin = createAdminClient();
  const summary: EveningSummary = {
    runDate,
    businesses: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const { data: run } = await admin
    .from("job_runs")
    .insert({ job: "evening_reminders", run_date: runDate })
    .select("id")
    .single();

  const { data: connections } = await admin
    .from("whatsapp_connections")
    .select("tenant_id")
    .eq("status", "CONNECTED");

  for (const { tenant_id: tenantId } of connections ?? []) {
    try {
      const [{ data: tenant }, { data: settings }] = await Promise.all([
        admin
          .from("tenants")
          .select("id, name, status, trial_ends_at, subscription_ends_at, whatsapp_addon")
          .eq("id", tenantId)
          .single(),
        admin
          .from("whatsapp_settings")
          .select("evening_reminder")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);
      if (
        !tenant ||
        !tenant.whatsapp_addon ||
        !tenantAccess(tenant).ok ||
        settings?.evening_reminder === false
      )
        continue;
      summary.businesses++;

      const { data: orders, error } = await admin
        .from("rental_orders")
        .select(`id, closed_at, ${ORDER_FOR_MESSAGES}`)
        .eq("tenant_id", tenantId)
        .in("status", ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE", "RETURNED"])
        .is("closed_at", null)
        .lte("event_start_date", runDate);
      if (error) throw new Error(error.message);

      for (const order of (orders ?? []) as (EveningOrder & { id: string })[]) {
        const type = eveningMessageFor(order, runDate);
        if (!type) continue;
        try {
          const result = await deliver({
            tenantId,
            businessName: tenant.name,
            order,
            orderId: order.id,
            type,
            sentBy: null,
            reminderDate: runDate,
          });
          if (result.ok) summary.sent++;
          else if (result.skipped) summary.skipped++;
          else {
            summary.failed++;
            summary.errors.push({ tenantId, orderId: order.id, error: result.error });
          }
        } catch (e) {
          summary.failed++;
          summary.errors.push({ tenantId, orderId: order.id, error: (e as Error).message });
        }
      }
    } catch (e) {
      summary.errors.push({ tenantId, error: (e as Error).message });
    }
  }

  if (run) {
    await admin
      .from("job_runs")
      .update({
        finished_at: new Date().toISOString(),
        businesses: summary.businesses,
        sent: summary.sent,
        failed: summary.failed,
        skipped: summary.skipped,
        errors: summary.errors.slice(0, 50),
      })
      .eq("id", run.id);
  }
  return summary;
}
