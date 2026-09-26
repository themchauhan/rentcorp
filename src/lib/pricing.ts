// Booking pricing rules. Pure functions, integer paise only.
//
// DAY-COUNT RULE (confirmed with the business owner 2026-09-26):
//   PER_DAY items are charged for every calendar day they are out,
//   counting BOTH the first and the last day. 12 Oct → 14 Oct = 3 days.
//   A same-day return is 1 day. In other words: any part of a day counts
//   as a full day. Dates are IST calendar dates.
// PER_EVENT items are charged once per booking, however many days.
//
// DISCOUNT RULE: one booking-level discount, applied to the gross total.
//   FLAT: a fixed amount in paise, capped at the gross (never negative).
//   PERCENT: basis points (1000 = 10%) of the gross, rounded to the
//   nearest paisa (half up). A % discount grows with the gross.

import { daysBetween } from "./dates";
import type { RateUnit } from "./items";

export type DiscountType = "NONE" | "FLAT" | "PERCENT";
export type Discount = { type: DiscountType; value: number };

export type PricedLine = {
  ratePaise: number;
  rateUnit: RateUnit;
  quantity: number;
};

/** Chargeable days between two IST dates, inclusive (minimum 1). */
export function chargeableDays(startDate: string, endDate: string): number {
  return Math.max(1, daysBetween(startDate, endDate) + 1);
}

/** Amount for one line over `days` chargeable days. */
export function lineAmount(line: PricedLine, days: number): number {
  const units = line.rateUnit === "PER_DAY" ? days : 1;
  const amount = line.ratePaise * line.quantity * units;
  if (!Number.isSafeInteger(amount)) throw new Error("Line amount out of range");
  return amount;
}

/** Discount in paise for a gross amount. */
export function discountAmount(grossPaise: number, discount: Discount): number {
  switch (discount.type) {
    case "NONE":
      return 0;
    case "FLAT":
      return Math.min(Math.max(discount.value, 0), grossPaise);
    case "PERCENT": {
      const bp = BigInt(Math.min(Math.max(discount.value, 0), 10_000));
      // BigInt so large bookings can't overflow; + 5000 rounds half up.
      return Number((BigInt(grossPaise) * bp + BigInt(5_000)) / BigInt(10_000));
    }
  }
}

export type Estimate = {
  days: number;
  lineAmounts: number[];
  gross: number;
  discount: number;
  total: number;
};

/** Planned total for a booking from its start to its expected return. */
export function estimateBooking(
  lines: PricedLine[],
  startDate: string,
  expectedReturnDate: string,
  discount: Discount,
): Estimate {
  const days = chargeableDays(startDate, expectedReturnDate);
  const lineAmounts = lines.map((l) => lineAmount(l, days));
  const gross = lineAmounts.reduce((a, b) => a + b, 0);
  const d = discountAmount(gross, discount);
  return { days, lineAmounts, gross, discount: d, total: gross - d };
}

/** "12.5" → 1250 basis points. Null unless 0–100 with ≤ 2 decimals. */
export function parsePercentToBasisPoints(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.replace(/[%\s]/g, ""));
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}

/** 1250 → "12.5%" */
export function formatBasisPoints(bp: number): string {
  return `${(bp / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
}
