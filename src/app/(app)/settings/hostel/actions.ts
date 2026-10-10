"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { mealPlanSchema, settingsSchema } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; done?: string };

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Check the details.";

function refresh() {
  revalidatePath("/settings/hostel");
}

export async function saveHostelSettings(_prev: State, fd: FormData): Promise<State> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const parsed = settingsSchema.safeParse({
    electricity: String(fd.get("electricity") ?? ""),
    deposit: String(fd.get("deposit") ?? ""),
    noticeDays: String(fd.get("noticeDays") ?? ""),
    agreementMonths: String(fd.get("agreementMonths") ?? ""),
    lockInMonths: String(fd.get("lockInMonths") ?? ""),
    increasePct: String(fd.get("increasePct") ?? ""),
    alertDays: String(fd.get("alertDays") ?? ""),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const row = {
    electricity_paise: parsed.data.electricity,
    deposit_paise: parsed.data.deposit,
    notice_days: parsed.data.noticeDays,
    agreement_months: parsed.data.agreementMonths,
    lock_in_months: parsed.data.lockInMonths,
    rent_increase_pct: parsed.data.increasePct,
    agreement_alert_days: parsed.data.alertDays,
  };
  const supabase = await createClient();
  // tenant_id comes from the session (default + trigger).
  const { error } = await supabase.from("pg_settings").upsert(row, { onConflict: "tenant_id" });
  if (error) return { error: "Couldn't save. Please try again." };
  await logAudit("pg.settings_changed", "pg_settings", null, row);
  refresh();
  return { done: "Saved. New residents get these amounts; existing ones keep theirs." };
}

export async function addMealPlan(_prev: State, fd: FormData): Promise<State> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const parsed = mealPlanSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    price: String(fd.get("price") ?? ""),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pg_meal_plans")
    .insert({ name: parsed.data.name, monthly_paise: parsed.data.price })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "You already have a plan with this name." };
    return { error: "Couldn't add the plan." };
  }
  await logAudit("pg.meal_plan_added", "pg_meal_plan", data.id, {
    name: parsed.data.name,
    monthly_paise: parsed.data.price,
  });
  refresh();
  return { done: `${parsed.data.name} added.` };
}

export async function updateMealPlan(_prev: State, fd: FormData): Promise<State> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("planId"));
  if (!id.success) return { error: "Plan not found." };
  const supabase = await createClient();
  if (fd.get("remove") === "1") {
    const { data, error } = await supabase
      .from("pg_meal_plans")
      .update({ active: false })
      .eq("id", id.data)
      .select("id");
    if (error || !data?.length) return { error: "Couldn't remove the plan." };
    await logAudit("pg.meal_plan_removed", "pg_meal_plan", id.data, {});
    refresh();
    return { done: "Plan removed. Residents on it keep it until changed." };
  }
  const parsed = mealPlanSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    price: String(fd.get("price") ?? ""),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { data, error } = await supabase
    .from("pg_meal_plans")
    .update({ name: parsed.data.name, monthly_paise: parsed.data.price })
    .eq("id", id.data)
    .select("id");
  if (error) {
    if (error.code === "23505") return { error: "You already have a plan with this name." };
    return { error: "Couldn't save the plan." };
  }
  if (!data?.length) return { error: "Plan not found." };
  await logAudit("pg.meal_plan_updated", "pg_meal_plan", id.data, {
    name: parsed.data.name,
    monthly_paise: parsed.data.price,
  });
  refresh();
  return { done: "Saved. Existing residents keep their agreed price." };
}
