// Amount-due engine. Pure, integer paise, no I/O. Given a booking, its
// returns and payments, and an "as of" date, it says what the customer
// owes on that date.
//
// Rules (see also src/lib/pricing.ts and docs/BRIEF.md):
//  1. Day count: PER_DAY items are charged for every IST calendar day
//     they are out, counting the first and the last day (any part of a
//     day is a full day). 12 → 14 Oct = 3 days; same day = 1 day.
//  2. PER_EVENT items are charged once for the full booked quantity as
//     soon as the booking has started, even if returned early.
//  3. Returns are per booking line and may be partial/staggered. Each
//     returned batch stops accruing on its own return date (that date
//     still counts). Items still out accrue up to the "as of" date.
//  4. Nothing accrues before the start date. A cancelled booking
//     accrues nothing.
//  5. One booking-level discount on the gross (FLAT capped at gross,
//     PERCENT half-up to the paisa, so a % discount grows with gross).
//  6. Balance = net − payments. Amount due never goes below zero;
//     overpayment shows as credit. The security deposit is separate and
//     never part of these figures.

import { daysBetween } from "./dates";
import type { RateUnit } from "./items";
import { discountAmount, type Discount } from "./pricing";

export type EngineReturn = { quantity: number; returnedOn: string };

export type EngineLine = {
  id: string;
  quantity: number;
  ratePaise: number;
  rateUnit: RateUnit;
  returns: EngineReturn[];
};

export type EngineBooking = {
  startDate: string;
  cancelled: boolean;
  discount: Discount;
  lines: EngineLine[];
  payments: { amountPaise: number }[];
};

export type LineDue = {
  id: string;
  amount: number;
  returnedQuantity: number;
  outQuantity: number;
};

export type AmountDue = {
  asOf: string;
  started: boolean;
  /** Chargeable days so far for items still out (0 before the start). */
  daysSoFar: number;
  lines: LineDue[];
  gross: number;
  discount: number;
  net: number;
  paid: number;
  balance: number;
  amountDue: number;
  credit: number;
};

/** Inclusive IST calendar days from start to `until`; 0 if `until` is before start. */
function daysOut(startDate: string, until: string): number {
  const d = daysBetween(startDate, until);
  return d < 0 ? 0 : d + 1;
}

function safe(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error("Amount out of range");
  return n;
}

export function computeAmountDue(booking: EngineBooking, asOf: string): AmountDue {
  const started = !booking.cancelled && daysBetween(booking.startDate, asOf) >= 0;
  const daysSoFar = started ? daysOut(booking.startDate, asOf) : 0;

  const lines: LineDue[] = booking.lines.map((line) => {
    // Returns recorded after the as-of date haven't happened yet.
    const returns = line.returns.filter((r) => daysBetween(r.returnedOn, asOf) >= 0);
    const returnedQuantity = returns.reduce((s, r) => s + r.quantity, 0);
    if (line.returns.reduce((s, r) => s + r.quantity, 0) > line.quantity) {
      throw new Error(`Line ${line.id}: more returned than booked`);
    }
    const outQuantity = line.quantity - returnedQuantity;

    if (!started) return { id: line.id, amount: 0, returnedQuantity, outQuantity };

    let amount: number;
    if (line.rateUnit === "PER_EVENT") {
      amount = safe(line.ratePaise * line.quantity);
    } else {
      const returnedPart = returns.reduce(
        (s, r) => s + safe(r.quantity * line.ratePaise * daysOut(booking.startDate, r.returnedOn)),
        0,
      );
      amount = safe(returnedPart + outQuantity * line.ratePaise * daysSoFar);
    }
    return { id: line.id, amount, returnedQuantity, outQuantity };
  });

  const gross = safe(lines.reduce((s, l) => s + l.amount, 0));
  const discount = discountAmount(gross, booking.discount);
  const net = gross - discount;
  const paid = safe(booking.payments.reduce((s, p) => s + p.amountPaise, 0));
  const balance = net - paid;

  return {
    asOf,
    started,
    daysSoFar,
    lines,
    gross,
    discount,
    net,
    paid,
    balance,
    amountDue: Math.max(0, balance),
    credit: Math.max(0, -balance),
  };
}
