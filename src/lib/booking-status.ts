import { daysBetween } from "./dates";

export type StoredStatus = "ACTIVE" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE" | "CANCELLED";

const OPEN: StoredStatus[] = ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"];

export function isOpen(status: StoredStatus): boolean {
  return OPEN.includes(status);
}

/**
 * Status as it stands today. There is no scheduled job, so an open booking
 * whose expected return date has passed is shown as OVERDUE when read.
 */
export function effectiveStatus(
  status: StoredStatus,
  expectedReturnDate: string,
  today: string,
): StoredStatus {
  if (isOpen(status) && daysBetween(expectedReturnDate, today) > 0) return "OVERDUE";
  if (status === "OVERDUE" && daysBetween(expectedReturnDate, today) <= 0) return "ACTIVE";
  return status;
}

/** Whole days past the expected return date (0 if not late). */
export function daysOverdue(expectedReturnDate: string, today: string): number {
  return Math.max(0, daysBetween(expectedReturnDate, today));
}
