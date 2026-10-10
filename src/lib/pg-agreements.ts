// Rent agreements (hostel / PG). Pure date and amount helpers; the database
// functions in 20261009000100_pg_agreements.sql use the same rules.
import { addDays, daysBetween } from "./dates";
import { addMonths } from "./subscriptions";

/** Last day of an agreement of `months` starting on `start` (11 months from 1 Jan → 30 Nov). */
export function agreementEnd(start: string, months: number): string {
  return addDays(addMonths(start, months), -1);
}

/** Last day of a lock-in of `months` (null when there is none). */
export function lockInUntil(start: string, months: number): string | null {
  return months > 0 ? agreementEnd(start, months) : null;
}

/** Current rent raised by `pct` %, rounded half-up to the nearest whole rupee. */
export function suggestedRent(currentPaise: number, pct: number): number {
  const raised = (currentPaise * (100 + pct)) / 100;
  return Math.floor(raised / 100 + 0.5) * 100;
}

/**
 * First due date (stay start + k months, k ≥ 1) on or after `from` and
 * after `today`: when a renewal's new rent starts. Mirrors pg_renew_agreement.
 */
export function firstDueOnOrAfter(stayStart: string, from: string, today: string): string {
  for (let k = 1; k < 1200; k++) {
    const d = addMonths(stayStart, k);
    if (d >= from && d > today) return d;
  }
  throw new Error("no due date found");
}

export type AgreementState =
  | { kind: "expired"; days: number }
  | { kind: "ending"; days: number }
  | { kind: "ok"; days: number };

/** Where an agreement stands today; "ending" within `alertDays` of its end. */
export function agreementState(endDate: string, today: string, alertDays: number): AgreementState {
  const days = daysBetween(today, endDate);
  if (days < 0) return { kind: "expired", days: -days };
  if (days <= alertDays) return { kind: "ending", days };
  return { kind: "ok", days };
}

/** Whether `date` (e.g. the notice date) falls inside the lock-in. */
export function inLockIn(lockInUntilDate: string | null, date: string): boolean {
  return lockInUntilDate !== null && date <= lockInUntilDate;
}
