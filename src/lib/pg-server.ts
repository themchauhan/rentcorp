import "server-only";
import { todayIST } from "./dates";
import { PG_DEFAULT_TEMPLATES, PG_MESSAGE_TYPES, type PgMessageType } from "./pg-messages";
import { computeStayDues, type StayDues, type StayInput, type StayStatus } from "./pg-dues";
import type { SupabaseServerClient } from "./supabase/server";

// Everything the dues engine needs for a stay, plus who / where.
export const STAY_SELECT = `id, status, start_date, moved_out_on, deposit_paise,
  notice_given_on, planned_move_out, created_at,
  customer:rental_customers (id, name, mobile, whatsapp_number, preferred_channel),
  room:pg_rooms (id, name, floor, rent_mode),
  bed:pg_beds (id, label),
  rates:pg_stay_rates (effective_from, rent_paise, meal_plan_id, meal_plan_name, meal_paise, electricity_paise),
  adjustments:pg_stay_adjustments (id, kind, amount_paise, reason, on_date, created_at),
  payments:pg_payments (id, purpose, kind, amount_paise, mode, reverses_payment_id, received_by, received_at, note)` as const;

type Row = {
  status: StayStatus;
  start_date: string;
  moved_out_on: string | null;
  rates: {
    effective_from: string;
    rent_paise: number;
    meal_paise: number;
    electricity_paise: number;
    meal_plan_name: string | null;
  }[];
  adjustments: {
    kind: "CHARGE" | "DISCOUNT";
    amount_paise: number;
    reason: string;
    on_date: string;
  }[];
  payments: { purpose: "RENT" | "DEPOSIT" | "REFUND"; amount_paise: number }[];
};

export function toStayInput(row: Row): StayInput {
  return {
    startDate: row.start_date,
    status: row.status,
    movedOutOn: row.moved_out_on,
    rates: row.rates.map((r) => ({
      effectiveFrom: r.effective_from,
      rentPaise: r.rent_paise,
      mealPaise: r.meal_paise,
      electricityPaise: r.electricity_paise,
      mealPlanName: r.meal_plan_name,
    })),
    adjustments: row.adjustments.map((a) => ({
      kind: a.kind,
      amountPaise: a.amount_paise,
      reason: a.reason,
      onDate: a.on_date,
    })),
    payments: row.payments.map((p) => ({ purpose: p.purpose, amountPaise: p.amount_paise })),
  };
}

export function duesFor(row: Row, asOf = todayIST()): StayDues {
  return computeStayDues(toStayInput(row), asOf);
}

/** Live stays (living here or on notice) with dues, for lists and Home. */
export async function loadLiveStays(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("pg_stays")
    .select(STAY_SELECT)
    .in("status", ["ACTIVE", "NOTICE"])
    .order("start_date");
  if (error) throw new Error("Couldn't load residents");
  const today = todayIST();
  return (data ?? []).map((s) => ({ stay: s, dues: duesFor(s, today) }));
}

export type LiveStay = Awaited<ReturnType<typeof loadLiveStays>>[number];

/** The PG's wording for resident messages (defaults where not customised). */
export async function loadPgTemplates(
  supabase: SupabaseServerClient,
): Promise<Record<PgMessageType, string>> {
  const { data } = await supabase
    .from("message_templates")
    .select("message_type, body")
    .in("message_type", PG_MESSAGE_TYPES);
  const templates = { ...PG_DEFAULT_TEMPLATES };
  for (const row of data ?? []) templates[row.message_type as PgMessageType] = row.body;
  return templates;
}
