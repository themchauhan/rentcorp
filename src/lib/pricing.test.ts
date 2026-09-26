import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, isIsoDate, todayIST } from "./dates";
import {
  chargeableDays,
  discountAmount,
  estimateBooking,
  formatBasisPoints,
  lineAmount,
  parsePercentToBasisPoints,
} from "./pricing";

describe("chargeableDays (inclusive calendar days)", () => {
  it("12 Oct → 14 Oct is 3 days", () => {
    expect(chargeableDays("2026-10-12", "2026-10-14")).toBe(3);
  });
  it("same-day return is 1 day", () => {
    expect(chargeableDays("2026-10-12", "2026-10-12")).toBe(1);
  });
  it("crosses month and year ends", () => {
    expect(chargeableDays("2026-12-31", "2027-01-01")).toBe(2);
    expect(chargeableDays("2028-02-28", "2028-03-01")).toBe(3); // leap year
  });
  it("never goes below 1", () => {
    expect(chargeableDays("2026-10-14", "2026-10-12")).toBe(1);
  });
});

describe("lineAmount", () => {
  it("multiplies per-day rates by days and quantity", () => {
    expect(lineAmount({ ratePaise: 1000, rateUnit: "PER_DAY", quantity: 100 }, 3)).toBe(300000);
  });
  it("charges per-event items once", () => {
    expect(lineAmount({ ratePaise: 150000, rateUnit: "PER_EVENT", quantity: 2 }, 3)).toBe(300000);
  });
});

describe("discountAmount", () => {
  it("caps a flat discount at the gross", () => {
    expect(discountAmount(80000, { type: "FLAT", value: 100000 })).toBe(80000);
    expect(discountAmount(80000, { type: "FLAT", value: 50000 })).toBe(50000);
  });
  it("rounds a % discount to the nearest paisa, half up", () => {
    expect(discountAmount(75000, { type: "PERCENT", value: 1000 })).toBe(7500);
    expect(discountAmount(333, { type: "PERCENT", value: 1500 })).toBe(50); // 49.95 → 50
    expect(discountAmount(101, { type: "PERCENT", value: 5000 })).toBe(51); // 50.5 → 51
  });
  it("handles very large bookings without overflow", () => {
    expect(discountAmount(9_000_000_000_000, { type: "PERCENT", value: 10_000 })).toBe(
      9_000_000_000_000,
    );
  });
  it("is zero for NONE", () => {
    expect(discountAmount(5000, { type: "NONE", value: 0 })).toBe(0);
  });
});

describe("estimateBooking", () => {
  it("matches a hand-computed wedding booking", () => {
    // 100 chairs ₹10/day, 1 shamiana ₹1,500/event, 12→14 Oct (3 days), 10% off.
    const e = estimateBooking(
      [
        { ratePaise: 1000, rateUnit: "PER_DAY", quantity: 100 },
        { ratePaise: 150000, rateUnit: "PER_EVENT", quantity: 1 },
      ],
      "2026-10-12",
      "2026-10-14",
      { type: "PERCENT", value: 1000 },
    );
    expect(e).toEqual({
      days: 3,
      lineAmounts: [300000, 150000],
      gross: 450000,
      discount: 45000,
      total: 405000,
    });
  });
});

describe("percent parsing", () => {
  it.each([
    ["10", 1000],
    ["12.5", 1250],
    ["12.25%", 1225],
    ["0", 0],
    ["100", 10000],
  ])("parses %s", (input, bp) => expect(parsePercentToBasisPoints(input)).toBe(bp));
  it.each(["101", "-5", "12.345", "abc", ""])("rejects %j", (input) =>
    expect(parsePercentToBasisPoints(input)).toBeNull(),
  );
  it("formats basis points", () => {
    expect(formatBasisPoints(1250)).toBe("12.5%");
    expect(formatBasisPoints(1000)).toBe("10%");
  });
});

describe("dates", () => {
  it("todayIST uses the India date, not UTC", () => {
    // 20:00 UTC on 25 Sep is already 26 Sep in India.
    expect(todayIST(new Date("2026-09-25T20:00:00Z"))).toBe("2026-09-26");
  });
  it("validates and does arithmetic on calendar dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-12")).toBe(true);
    expect(daysBetween("2026-10-12", "2026-10-14")).toBe(2);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatDate("2026-10-12")).toBe("12 Oct 2026");
  });
});
