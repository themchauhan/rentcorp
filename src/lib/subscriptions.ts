// Subscription date helpers (IST). End dates are stored as the last
// instant of that IST day, so "ends 12 Oct" means access through 12 Oct.
import { addDays, isIsoDate, todayIST } from "./dates";

export function endOfIstDay(date: string): string {
  if (!isIsoDate(date)) throw new Error("Expected YYYY-MM-DD");
  return `${date}T23:59:59.999+05:30`;
}

/** Stored timestamp → IST date "YYYY-MM-DD" (null stays null). */
export function istDateOf(ts: string | null): string | null {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts));
}

/** Adds whole months to a date, clamping to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * New subscription end when extending by `months`: from the current end if
 * it's still in the future, otherwise from today.
 */
export function extendedEnd(currentEnd: string | null, months: number, today = todayIST()): string {
  const current = istDateOf(currentEnd);
  const base = current && current >= today ? current : addDays(today, -1);
  return addMonths(base, months);
}
