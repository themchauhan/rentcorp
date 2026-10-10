"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant, requireTenantAdmin } from "@/lib/auth/guards";
import { isIsoDate } from "@/lib/dates";
import { formatRupees, parseRupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// Rent agreements. The business always comes from the session (database
// functions re-check it); ids in the form only pick a row the caller sees.

type State = { error?: string; done?: string };

const FRIENDLY = new Set(["22023", "23503", "23505", "23514", "42501"]);
const friendly = (e: { code?: string; message: string }, fallback: string) =>
  e.code && FRIENDLY.has(e.code) ? e.message : fallback;

const int = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) ? n : NaN;
};
const pctOf = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 50 ? Math.round(n * 100) / 100 : null;
};

function refresh(stayId: string) {
  revalidatePath(`/residents/${stayId}`);
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createAgreement(_prev: State, fd: FormData): Promise<State> {
  const member = await requireActiveTenant({ type: "HOSTEL_PG" });
  const stayId = z.uuid().safeParse(fd.get("stayId"));
  if (!stayId.success) return { error: "Resident not found." };
  const start = String(fd.get("start") ?? "");
  if (!isIsoDate(start)) return { error: "Choose the start date." };
  const months = int(fd.get("months"));
  if (!(months >= 1 && months <= 60)) return { error: "An agreement runs 1 to 60 months." };
  const lockIn = int(fd.get("lockInMonths") || "0");
  if (!(lockIn >= 0 && lockIn <= Math.min(24, months)))
    return { error: "Lock-in must be shorter than the agreement." };

  const supabase = await createClient();
  // Staff use the business's default increase %; the owner may set it.
  const { data: settings } = await supabase
    .from("pg_settings")
    .select("rent_increase_pct")
    .maybeSingle();
  const defaultPct = Number(settings?.rent_increase_pct ?? 0);
  const pct = member.role === "ADMIN" ? (pctOf(fd.get("increasePct")) ?? defaultPct) : defaultPct;

  const { data: id, error } = await supabase.rpc("pg_create_agreement", {
    p_stay_id: stayId.data,
    p_start: start,
    p_months: months,
    p_lock_in_months: lockIn,
    p_increase_pct: pct,
  });
  if (error) return { error: friendly(error, "Couldn't save the agreement. Please try again.") };
  await logAudit("pg.agreement_created", "pg_agreement", id, {
    stay_id: stayId.data,
    start,
    months,
    lock_in_months: lockIn,
    increase_pct: pct,
  });
  refresh(stayId.data);
  return { done: "Agreement saved." };
}

export async function updateAgreement(_prev: State, fd: FormData): Promise<State> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("agreementId"));
  const stayId = z.uuid().safeParse(fd.get("stayId"));
  if (!id.success || !stayId.success) return { error: "Agreement not found." };
  const end = String(fd.get("end") ?? "");
  if (!isIsoDate(end)) return { error: "Choose the end date." };
  const lockRaw = String(fd.get("lockInUntil") ?? "");
  if (lockRaw && !isIsoDate(lockRaw)) return { error: "Lock-in date is not valid." };
  const pct = pctOf(fd.get("increasePct"));
  if (pct === null) return { error: "Increase must be 0 to 50%." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pg_update_agreement", {
    p_agreement_id: id.data,
    p_end: end,
    p_lock_in_until: (lockRaw || null) as string,
    p_increase_pct: pct,
  });
  if (error) return { error: friendly(error, "Couldn't save. Please try again.") };
  await logAudit("pg.agreement_updated", "pg_agreement", id.data, {
    end,
    lock_in_until: lockRaw || null,
    increase_pct: pct,
  });
  refresh(stayId.data);
  return { done: "Agreement updated." };
}

export async function renewAgreement(_prev: State, fd: FormData): Promise<State> {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  const id = z.uuid().safeParse(fd.get("agreementId"));
  const stayId = z.uuid().safeParse(fd.get("stayId"));
  if (!id.success || !stayId.success) return { error: "Agreement not found." };
  const months = int(fd.get("months"));
  if (!(months >= 1 && months <= 60)) return { error: "An agreement runs 1 to 60 months." };
  const rentRaw = String(fd.get("newRent") ?? "").trim();
  const rent = rentRaw ? parseRupeesToPaise(rentRaw) : null;
  if (rentRaw && (rent === null || rent > 100000000)) return { error: "Enter a valid rent." };

  const supabase = await createClient();
  const { data: newId, error } = await supabase.rpc("pg_renew_agreement", {
    p_agreement_id: id.data,
    p_months: months,
    ...(rent !== null ? { p_new_rent_paise: rent } : {}),
  });
  if (error) return { error: friendly(error, "Couldn't renew. Please try again.") };
  await logAudit("pg.agreement_renewed", "pg_agreement", newId, {
    renewed_from: id.data,
    months,
    new_rent_paise: rent,
  });
  refresh(stayId.data);
  return {
    done:
      rent !== null
        ? `Renewed for ${months} months. New rent ${formatRupees(rent)} from the first due date of the new term.`
        : `Renewed for ${months} months.`,
  };
}
