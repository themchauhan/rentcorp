"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/auth/mobile";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant } from "@/lib/auth/guards";
import { isIsoDate } from "@/lib/dates";
import { parseCustomer, readCustomerForm, type CustomerFormField } from "@/lib/customers";
import { findDuplicateCustomer, insertCustomer } from "@/lib/customers-server";
import { parseRupeesToPaise } from "@/lib/money";
import { ID_TYPES } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

export type MoveInState = {
  error?: string;
  customerErrors?: Partial<Record<CustomerFormField, string>>;
  fieldErrors?: Partial<Record<MoveInField, string>>;
  values?: Record<string, string>;
};
type MoveInField =
  | "place"
  | "startDate"
  | "deposit"
  | "agreementMonths"
  | "lockInMonths"
  | "rent"
  | "mealPlanId"
  | "emergencyMobile"
  | "emergencyName"
  | "occupation";

// Messages raised by the database functions are written for people.
const FRIENDLY = new Set(["22023", "23503", "23505", "23514", "42501"]);

/** Resident details beyond name and phone (optional). */
function readDetails(fd: FormData) {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const errors: MoveInState["fieldErrors"] = {};
  const emergencyMobileRaw = get("emergencyMobile");
  const emergencyMobile = emergencyMobileRaw ? normalizeIndianMobile(emergencyMobileRaw) : null;
  if (emergencyMobileRaw && !emergencyMobile)
    errors.emergencyMobile = "Enter a valid 10-digit mobile";
  const emergencyName = get("emergencyName");
  if (emergencyName.length > 120) errors.emergencyName = "Keep it under 120 characters";
  const occupation = get("occupation");
  if (occupation.length > 120) errors.occupation = "Keep it under 120 characters";
  const idType = z.enum(ID_TYPES).safeParse(get("idType"));
  return {
    errors,
    row: {
      emergency_name: emergencyName || null,
      emergency_mobile: emergencyMobile,
      occupation: occupation || null,
      id_type: idType.success ? idType.data : null,
    },
  };
}

export async function moveIn(_prev: MoveInState, fd: FormData): Promise<MoveInState> {
  const member = await requireActiveTenant({ type: "HOSTEL_PG" });
  const values = Object.fromEntries(
    [...fd.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const customer = parseCustomer(readCustomerForm(fd, "c_"));
  const details = readDetails(fd);
  const fieldErrors: NonNullable<MoveInState["fieldErrors"]> = { ...details.errors };

  const place = /^(bed|room):([0-9a-f-]{36})$/.exec(String(fd.get("place") ?? ""));
  if (!place) fieldErrors.place = "Choose a vacant bed or room";
  const startDate = String(fd.get("startDate") ?? "");
  if (!isIsoDate(startDate)) fieldErrors.startDate = "Choose the joining date";
  const deposit = parseRupeesToPaise(String(fd.get("deposit") ?? "0") || "0");
  if (deposit === null || deposit > 100000000) fieldErrors.deposit = "Enter a valid deposit";
  const rentRaw = String(fd.get("rent") ?? "").trim();
  const rent = rentRaw ? parseRupeesToPaise(rentRaw) : null;
  if (rentRaw && (rent === null || rent > 100000000)) fieldErrors.rent = "Enter a valid rent";
  if (rentRaw && member.role !== "ADMIN")
    fieldErrors.rent = "Only the owner can set a different rent";
  // Agreement created with the move-in (0 months = none).
  const agreementMonths = Number(String(fd.get("agreementMonths") ?? "0").trim() || "0");
  if (!Number.isInteger(agreementMonths) || agreementMonths < 0 || agreementMonths > 60)
    fieldErrors.agreementMonths = "0 to 60 months";
  const lockInMonths = Number(String(fd.get("lockInMonths") ?? "0").trim() || "0");
  if (
    !Number.isInteger(lockInMonths) ||
    lockInMonths < 0 ||
    lockInMonths > Math.min(24, agreementMonths || 24)
  )
    fieldErrors.lockInMonths = "Lock-in must be shorter than the agreement";
  const mealRaw = String(fd.get("mealPlanId") ?? "");
  const meal = mealRaw ? z.uuid().safeParse(mealRaw) : null;
  if (meal && !meal.success) fieldErrors.mealPlanId = "Choose a meal plan";

  if (!customer.ok || Object.keys(fieldErrors).length) {
    return {
      values,
      error: "Check the highlighted details.",
      customerErrors: customer.ok ? undefined : customer.fieldErrors,
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const existing = await findDuplicateCustomer(supabase, customer.row);
  const customerId = existing?.id ?? (await insertCustomer(supabase, customer.row));
  if (!customerId) return { values, error: "Couldn't save the resident. Please try again." };

  const hasDetails = Object.values(details.row).some((v) => v !== null);
  if (hasDetails) {
    await supabase
      .from("pg_resident_details")
      .upsert({ customer_id: customerId, ...details.row }, { onConflict: "tenant_id,customer_id" });
  }

  const { data: stayId, error } = await supabase.rpc("pg_move_in", {
    p_customer_id: customerId,
    p_room_id: place![1] === "room" ? place![2] : (null as unknown as string),
    p_bed_id: place![1] === "bed" ? place![2] : (null as unknown as string),
    p_start_date: startDate,
    p_meal_plan_id: meal?.success ? meal.data : (null as unknown as string),
    p_deposit_paise: deposit!,
    ...(rent !== null ? { p_rent_paise: rent } : {}),
  });
  if (error || !stayId) {
    if (error?.code === "23505" && /customer/.test(error.message))
      return { values, error: "This person already lives here." };
    if (error?.code === "23505")
      return { values, error: "That bed was just taken. Choose another." };
    if (error && FRIENDLY.has(error.code)) return { values, error: error.message };
    console.error("pg_move_in failed:", error?.message);
    return { values, error: "Couldn't save the move-in. Please try again." };
  }
  if (agreementMonths > 0) {
    const { data: settings } = await supabase
      .from("pg_settings")
      .select("rent_increase_pct")
      .maybeSingle();
    const { data: agreementId, error: agreementError } = await supabase.rpc("pg_create_agreement", {
      p_stay_id: stayId,
      p_start: startDate,
      p_months: agreementMonths,
      p_lock_in_months: lockInMonths,
      p_increase_pct: Number(settings?.rent_increase_pct ?? 0),
    });
    // The move-in stands either way; the agreement can be added on the resident page.
    if (agreementError) console.error("pg_create_agreement failed:", agreementError.message);
    else
      await logAudit("pg.agreement_created", "pg_agreement", agreementId, {
        stay_id: stayId,
        start: startDate,
        months: agreementMonths,
        lock_in_months: lockInMonths,
      });
  }
  await logAudit("pg.moved_in", "pg_stay", stayId, {
    customer_id: customerId,
    start_date: startDate,
    deposit_paise: deposit,
    rent_override_paise: rent,
    existing_customer: Boolean(existing),
  });
  revalidatePath("/rooms");
  revalidatePath("/residents");
  redirect(`/residents/${stayId}?created=1`);
}

export async function saveResidentDetails(
  _prev: { error?: string; done?: string },
  fd: FormData,
): Promise<{ error?: string; done?: string }> {
  await requireActiveTenant({ type: "HOSTEL_PG" });
  const customerId = z.uuid().safeParse(fd.get("customerId"));
  if (!customerId.success) return { error: "Resident not found." };
  const details = readDetails(fd);
  const first = Object.values(details.errors)[0];
  if (first) return { error: first };
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("rental_customers")
    .select("id")
    .eq("id", customerId.data)
    .maybeSingle();
  if (!c) return { error: "Resident not found." };
  const { error } = await supabase
    .from("pg_resident_details")
    .upsert({ customer_id: c.id, ...details.row }, { onConflict: "tenant_id,customer_id" });
  if (error) return { error: "Couldn't save. Please try again." };
  await logAudit("pg.resident_details_updated", "rental_customer", c.id, {
    id_type: details.row.id_type,
  });
  revalidatePath("/residents", "layout");
  return { done: "Saved." };
}
