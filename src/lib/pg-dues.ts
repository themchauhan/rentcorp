// Hostel / PG dues engine. Pure, integer paise, no I/O. Mirrored in SQL by
// private.pg_stay_balance_paise / pg_stay_final_paise (keep them in step).
//
// Rules (owner decisions, 2026-10-05):
//  1. Rent is due on the joining date every month. Cycle k starts on
//     addMonths(start, k) — anchored on the joining date and clamped to the
//     month end, so a 31 Jan joiner is due 28/29 Feb, then 31 Mar.
//  2. A cycle is charged in full once it has started (start ≤ as-of). After
//     a move-out, cycles starting on or after the move-out date aren't
//     charged; the first cycle always is.
//  3. Each cycle charges rent + meal plan + electricity from the rate row in
//     effect on that cycle's start (rates are snapshotted per stay; a change
//     only applies from a future due date).
//  4. Owner adjustments: CHARGE adds, DISCOUNT subtracts (with a reason).
//  5. Balance = charges + extra charges − discounts − rent payments.
//     Payments and discounts settle the oldest charge first, so each month
//     shows Paid / Part paid / Due. Overpayment is credit.
//  6. The deposit is separate: never counted as rent. At move-out the final
//     amount = balance − deposit held + refunds already paid (positive =
//     collect from the resident, negative = refund owed to them).

import { addDays, daysBetween } from "./dates";
import { addMonths } from "./subscriptions";

export type StayStatus = "ACTIVE" | "NOTICE" | "MOVED_OUT" | "CANCELLED";
export type PaymentPurpose = "RENT" | "DEPOSIT" | "REFUND";

export type StayRate = {
  effectiveFrom: string;
  rentPaise: number;
  mealPaise: number;
  electricityPaise: number;
  mealPlanName: string | null;
};

export type StayAdjustment = {
  kind: "CHARGE" | "DISCOUNT";
  amountPaise: number;
  reason: string;
  onDate: string;
};

export type StayInput = {
  startDate: string;
  status: StayStatus;
  movedOutOn: string | null;
  rates: StayRate[];
  adjustments: StayAdjustment[];
  /** Payments and reversals (negative amounts). */
  payments: { purpose: PaymentPurpose; amountPaise: number }[];
};

export type CycleStatus = "PAID" | "PART" | "DUE";

export type Cycle = {
  index: number;
  start: string;
  /** Last day of the cycle (the day before the next due date). */
  end: string;
  rentPaise: number;
  mealPaise: number;
  electricityPaise: number;
  mealPlanName: string | null;
  total: number;
  paid: number;
  status: CycleStatus;
};

export type StayDues = {
  asOf: string;
  cycles: Cycle[];
  cycleCharges: number;
  extraCharges: number;
  discounts: number;
  rentPaid: number;
  /** charges − discounts − rent paid (negative = credit). */
  balance: number;
  amountDue: number;
  credit: number;
  depositHeld: number;
  refunds: number;
  /** Next due date after as-of while living here; null once moved out. */
  nextDueDate: string | null;
  /** Start of the oldest cycle not fully paid, if any. */
  oldestUnpaid: string | null;
  /** Days since the oldest unpaid cycle started (0 = due today). */
  daysOverdue: number;
  /** balance − deposit held + refunds: + collect, − refund owed. */
  final: number;
};

const MAX_CYCLES = 1200;

/** Rate row in effect on `date` (latest effective_from ≤ date). */
export function rateOn(rates: StayRate[], date: string): StayRate | null {
  let best: StayRate | null = null;
  for (const r of rates) {
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom > best.effectiveFrom)) best = r;
  }
  return best;
}

/** Due dates (cycle starts) from the joining date, up to and including `until`. */
export function dueDates(startDate: string, until: string): string[] {
  const out: string[] = [];
  for (let k = 0; k < MAX_CYCLES; k++) {
    const d = addMonths(startDate, k);
    if (d > until) break;
    out.push(d);
  }
  return out;
}

/** Whether `date` is one of the stay's due dates (after the joining date). */
export function isDueDate(startDate: string, date: string): boolean {
  for (let k = 1; k < MAX_CYCLES; k++) {
    const d = addMonths(startDate, k);
    if (d === date) return true;
    if (d > date) return false;
  }
  return false;
}

export function computeStayDues(stay: StayInput, asOf: string): StayDues {
  const cancelled = stay.status === "CANCELLED";
  const cycles: Cycle[] = [];
  if (!cancelled) {
    for (let k = 0; k < MAX_CYCLES; k++) {
      const start = addMonths(stay.startDate, k);
      if (start > asOf) break;
      if (k > 0 && stay.movedOutOn && start >= stay.movedOutOn) break;
      const rate = rateOn(stay.rates, start);
      if (!rate) continue;
      const next = addMonths(stay.startDate, k + 1);
      const total = rate.rentPaise + rate.mealPaise + rate.electricityPaise;
      cycles.push({
        index: k,
        start,
        end: addDays(next, -1),
        rentPaise: rate.rentPaise,
        mealPaise: rate.mealPaise,
        electricityPaise: rate.electricityPaise,
        mealPlanName: rate.mealPlanName,
        total,
        paid: 0,
        status: "DUE",
      });
    }
  }

  const cycleCharges = cycles.reduce((s, c) => s + c.total, 0);
  const adj = cancelled ? [] : stay.adjustments;
  const extraCharges = adj
    .filter((a) => a.kind === "CHARGE")
    .reduce((s, a) => s + a.amountPaise, 0);
  const discounts = adj.filter((a) => a.kind === "DISCOUNT").reduce((s, a) => s + a.amountPaise, 0);
  const sumOf = (p: PaymentPurpose) =>
    stay.payments.filter((x) => x.purpose === p).reduce((s, x) => s + x.amountPaise, 0);
  const rentPaid = sumOf("RENT");
  const depositHeld = sumOf("DEPOSIT");
  const refunds = sumOf("REFUND");

  // Settle the oldest charge first (cycles and extra charges by date).
  let pool = Math.max(0, rentPaid + discounts);
  const charges = [
    ...cycles.map((c) => ({ date: c.start, amount: c.total, cycle: c })),
    ...adj
      .filter((a) => a.kind === "CHARGE")
      .map((a) => ({ date: a.onDate, amount: a.amountPaise, cycle: null as Cycle | null })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.cycle ? -1 : 1));
  let oldestUnpaid: string | null = null;
  for (const ch of charges) {
    const take = Math.min(pool, ch.amount);
    pool -= take;
    if (ch.cycle) {
      ch.cycle.paid = take;
      ch.cycle.status = take >= ch.amount ? "PAID" : take > 0 ? "PART" : "DUE";
    }
    if (take < ch.amount && oldestUnpaid === null) oldestUnpaid = ch.date;
  }

  const balance = cycleCharges + extraCharges - discounts - rentPaid;
  const live = stay.status === "ACTIVE" || stay.status === "NOTICE";
  const nextDueDate = live
    ? stay.startDate > asOf
      ? stay.startDate
      : addMonths(stay.startDate, cycles.length || 1)
    : null;
  return {
    asOf,
    cycles,
    cycleCharges,
    extraCharges,
    discounts,
    rentPaid,
    balance,
    amountDue: Math.max(0, balance),
    credit: Math.max(0, -balance),
    depositHeld,
    refunds,
    nextDueDate,
    oldestUnpaid: balance > 0 ? oldestUnpaid : null,
    daysOverdue: balance > 0 && oldestUnpaid ? Math.max(0, daysBetween(oldestUnpaid, asOf)) : 0,
    final: balance - depositHeld + refunds,
  };
}
