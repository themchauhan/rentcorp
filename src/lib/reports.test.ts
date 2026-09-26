import { describe, expect, it } from "vitest";
import { istDayBounds, resolveRange, summarizeCollections, summarizeDiscounts } from "./reports";

describe("summarizeCollections", () => {
  it("nets reversals and groups by mode and staff", () => {
    const s = summarizeCollections([
      { amount_paise: 100000, mode: "CASH", received_by: "a", kind: "PAYMENT" },
      { amount_paise: 50000, mode: "UPI", received_by: "b", kind: "PAYMENT" },
      { amount_paise: 25000, mode: "UPI", received_by: "a", kind: "PAYMENT" },
      { amount_paise: -50000, mode: "UPI", received_by: "owner", kind: "REVERSAL" },
    ]);
    expect(s.total).toBe(125000);
    expect(s.count).toBe(3);
    expect(s.reversals).toBe(1);
    expect(s.byMode).toEqual([
      { mode: "CASH", amount: 100000 },
      { mode: "UPI", amount: 25000 },
    ]);
    expect(s.byStaff).toEqual([
      { userId: "a", amount: 125000, count: 2 },
      { userId: "b", amount: 50000, count: 1 },
      { userId: "owner", amount: -50000, count: 0 },
    ]);
  });

  it("is empty for no payments", () => {
    expect(summarizeCollections([])).toEqual({
      total: 0,
      count: 0,
      reversals: 0,
      byMode: [],
      byStaff: [],
    });
  });
});

describe("summarizeDiscounts", () => {
  it("groups discounts by who gave them", () => {
    expect(
      summarizeDiscounts([
        { updatedBy: "a", amount: 500 },
        { updatedBy: "b", amount: 1000 },
        { updatedBy: "a", amount: 700 },
      ]),
    ).toEqual({
      total: 2200,
      count: 3,
      byStaff: [
        { userId: "a", amount: 1200, count: 2 },
        { userId: "b", amount: 1000, count: 1 },
      ],
    });
  });
});

describe("resolveRange", () => {
  const today = "2026-09-26";
  it("defaults to the start of this month through today", () => {
    expect(resolveRange(undefined, undefined, today)).toEqual({ from: "2026-09-01", to: today });
  });
  it("clamps future ends, swapped ranges and over-long ranges", () => {
    expect(resolveRange("2026-09-10", "2026-12-01", today)).toEqual({
      from: "2026-09-10",
      to: today,
    });
    expect(resolveRange("2026-09-20", "2026-09-10", today)).toEqual({
      from: "2026-09-10",
      to: "2026-09-10",
    });
    expect(resolveRange("2020-01-01", today, today).from).toBe("2025-09-25");
    expect(resolveRange("garbage", "nope", today)).toEqual({ from: "2026-09-01", to: today });
  });
  it("turns IST days into timestamp bounds", () => {
    expect(istDayBounds("2026-09-01", "2026-09-26")).toEqual({
      gte: "2026-09-01T00:00:00+05:30",
      lt: "2026-09-27T00:00:00+05:30",
    });
  });
});
