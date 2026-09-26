import { describe, expect, it } from "vitest";
import { computeAmountDue, type EngineBooking, type EngineLine } from "./amount-due";
import { addDays } from "./dates";

const START = "2026-10-12";

const chairs = (over: Partial<EngineLine> = {}): EngineLine => ({
  id: "chairs",
  quantity: 100,
  ratePaise: 1000, // ₹10 / day
  rateUnit: "PER_DAY",
  returns: [],
  ...over,
});
const shamiana: EngineLine = {
  id: "shamiana",
  quantity: 1,
  ratePaise: 150000, // ₹1,500 / event
  rateUnit: "PER_EVENT",
  returns: [],
};

const booking = (over: Partial<EngineBooking> = {}): EngineBooking => ({
  startDate: START,
  cancelled: false,
  discount: { type: "NONE", value: 0 },
  lines: [chairs(), shamiana],
  payments: [],
  ...over,
});

describe("same-day return", () => {
  it("charges exactly one day's rate", () => {
    const b = booking({
      lines: [chairs({ returns: [{ quantity: 100, returnedOn: START }] })],
    });
    const r = computeAmountDue(b, START);
    expect(r.gross).toBe(100_000); // 100 × ₹10 × 1 day
    // And it stays one day's rate afterwards: returned items stop accruing.
    expect(computeAmountDue(b, addDays(START, 5)).gross).toBe(100_000);
  });
});

describe("multi-day active booking", () => {
  it("increases by one day's charge each day", () => {
    const b = booking();
    const byDay = [0, 1, 2, 3, 4].map((d) => computeAmountDue(b, addDays(START, d)));
    // Chairs ₹1,000/day plus the ₹1,500 shamiana once.
    expect(byDay.map((r) => r.amountDue)).toEqual([250_000, 350_000, 450_000, 550_000, 650_000]);
    expect(byDay.map((r) => r.daysSoFar)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps accruing past the expected return date (overdue)", () => {
    expect(computeAmountDue(booking(), addDays(START, 9)).gross).toBe(100 * 1000 * 10 + 150_000);
  });
});

describe("partial return mid-rental", () => {
  it("stops accruing only for the returned items, from their own return date", () => {
    // 100 chairs out on 12 Oct; 40 back on 13 Oct; 60 still out.
    const b = booking({
      lines: [chairs({ returns: [{ quantity: 40, returnedOn: addDays(START, 1) }] }), shamiana],
    });
    const on15 = computeAmountDue(b, addDays(START, 3)); // 4 days in
    // 40 × ₹10 × 2 days + 60 × ₹10 × 4 days + ₹1,500 = ₹800 + ₹2,400 + ₹1,500
    expect(on15.lines).toEqual([
      { id: "chairs", amount: 320_000, returnedQuantity: 40, outQuantity: 60 },
      { id: "shamiana", amount: 150_000, returnedQuantity: 0, outQuantity: 1 },
    ]);
    expect(on15.gross).toBe(470_000);
    // One day later only the 60 still out add to the total.
    expect(computeAmountDue(b, addDays(START, 4)).gross).toBe(470_000 + 60 * 1000);
  });

  it("handles staggered returns and ignores returns after the as-of date", () => {
    const b = booking({
      lines: [
        chairs({
          returns: [
            { quantity: 30, returnedOn: addDays(START, 1) },
            { quantity: 70, returnedOn: addDays(START, 3) },
          ],
        }),
      ],
    });
    // As of 13 Oct the 70 haven't come back yet.
    expect(computeAmountDue(b, addDays(START, 1)).lines[0]).toMatchObject({ outQuantity: 70 });
    // Final: 30 × 2 days + 70 × 4 days = 60 + 280 chair-days × ₹10.
    expect(computeAmountDue(b, addDays(START, 10)).gross).toBe(340 * 1000);
  });

  it("charges per-event items once even when returned early", () => {
    const b = booking({
      lines: [{ ...shamiana, returns: [{ quantity: 1, returnedOn: START }] }],
    });
    expect(computeAmountDue(b, addDays(START, 7)).gross).toBe(150_000);
  });

  it("rejects returning more than was booked", () => {
    const b = booking({ lines: [chairs({ returns: [{ quantity: 101, returnedOn: START }] })] });
    expect(() => computeAmountDue(b, START)).toThrow(/more returned than booked/);
  });
});

describe("discounts", () => {
  it("a flat discount larger than the gross floors at zero, never negative", () => {
    const b = booking({ lines: [chairs()], discount: { type: "FLAT", value: 10_000_000 } });
    const r = computeAmountDue(b, START);
    expect(r).toMatchObject({ gross: 100_000, discount: 100_000, net: 0, amountDue: 0, credit: 0 });
  });

  it("a % discount grows day by day with the gross", () => {
    const b = booking({ lines: [chairs()], discount: { type: "PERCENT", value: 1000 } }); // 10%
    expect([0, 1, 2].map((d) => computeAmountDue(b, addDays(START, d)).discount)).toEqual([
      10_000, 20_000, 30_000,
    ]);
  });

  it("rounds odd-paise % discounts half up", () => {
    // 1 × ₹3.33/day × 1 day = 333 paise; 15% = 49.95 → 50 paise.
    const b = booking({
      lines: [chairs({ quantity: 1, ratePaise: 333 })],
      discount: { type: "PERCENT", value: 1500 },
    });
    expect(computeAmountDue(b, START)).toMatchObject({ gross: 333, discount: 50, net: 283 });
  });
});

describe("payments, start date and cancellation", () => {
  it("subtracts payments and reports overpayment as credit", () => {
    const b = booking({
      lines: [chairs()],
      payments: [{ amountPaise: 60_000 }, { amountPaise: 60_000 }],
    });
    expect(computeAmountDue(b, START)).toMatchObject({
      net: 100_000,
      paid: 120_000,
      balance: -20_000,
      amountDue: 0,
      credit: 20_000,
    });
  });

  it("owes nothing before the start date", () => {
    const r = computeAmountDue(booking(), addDays(START, -1));
    expect(r).toMatchObject({ started: false, daysSoFar: 0, gross: 0, amountDue: 0 });
  });

  it("a cancelled booking accrues nothing (payments become credit)", () => {
    const r = computeAmountDue(
      booking({ cancelled: true, payments: [{ amountPaise: 5_000 }] }),
      addDays(START, 3),
    );
    expect(r).toMatchObject({ gross: 0, amountDue: 0, credit: 5_000 });
  });
});

describe("consistency with the booking-form estimate", () => {
  it("equals the planned estimate when evaluated on the expected return date", async () => {
    const { estimateBooking } = await import("./pricing");
    const discount = { type: "PERCENT" as const, value: 1250 };
    const planned = estimateBooking(
      [
        { ratePaise: 1000, rateUnit: "PER_DAY", quantity: 100 },
        { ratePaise: 150000, rateUnit: "PER_EVENT", quantity: 1 },
      ],
      START,
      addDays(START, 2),
      discount,
    );
    const due = computeAmountDue(booking({ discount }), addDays(START, 2));
    expect(due.net).toBe(planned.total);
  });
});

describe("matches the SQL final bill (supabase/tests/70_returns_payments.test.sql)", () => {
  it("4 chairs back after 2 days, 6 chairs + shamiana after 4 days → ₹1,820", () => {
    const b = booking({
      lines: [
        chairs({
          quantity: 10,
          returns: [
            { quantity: 4, returnedOn: addDays(START, 1) },
            { quantity: 6, returnedOn: addDays(START, 3) },
          ],
        }),
        { ...shamiana, returns: [{ quantity: 1, returnedOn: addDays(START, 3) }] },
      ],
    });
    expect(computeAmountDue(b, addDays(START, 3)).gross).toBe(182_000);
    const discounted = computeAmountDue(
      { ...b, discount: { type: "PERCENT", value: 1000 }, payments: [{ amountPaise: 100_000 }] },
      addDays(START, 3),
    );
    expect(discounted.balance).toBe(63_800);
  });
});
