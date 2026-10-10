import { describe, expect, it } from "vitest";
import {
  agreementEnd,
  agreementState,
  firstDueOnOrAfter,
  inLockIn,
  lockInUntil,
  suggestedRent,
} from "./pg-agreements";

describe("agreement dates", () => {
  it("ends the day before the same date N months later", () => {
    expect(agreementEnd("2026-01-01", 11)).toBe("2026-11-30");
    expect(agreementEnd("2026-03-12", 11)).toBe("2027-02-11");
  });

  it("clamps month ends (31 Jan + 1 month ends 27/28 Feb)", () => {
    expect(agreementEnd("2026-01-31", 1)).toBe("2026-02-27");
    expect(agreementEnd("2028-01-31", 1)).toBe("2028-02-28"); // leap year
  });

  it("has no lock-in for 0 months", () => {
    expect(lockInUntil("2026-01-01", 0)).toBeNull();
    expect(lockInUntil("2026-01-01", 6)).toBe("2026-06-30");
  });
});

describe("suggestedRent", () => {
  it("raises by the percentage, rounded to whole rupees", () => {
    expect(suggestedRent(600000, 5)).toBe(630000); // ₹6,000 → ₹6,300
    expect(suggestedRent(733300, 5)).toBe(770000); // ₹7,699.65 → ₹7,700
    expect(suggestedRent(600050, 0)).toBe(600100); // half-up
    expect(suggestedRent(600000, 0)).toBe(600000);
  });
});

describe("firstDueOnOrAfter", () => {
  it("is the first due date in the new term", () => {
    expect(firstDueOnOrAfter("2026-01-12", "2026-12-01", "2026-11-20")).toBe("2026-12-12");
    expect(firstDueOnOrAfter("2026-01-12", "2026-12-12", "2026-11-20")).toBe("2026-12-12");
  });

  it("is never today or earlier (late renewals use the next due date)", () => {
    expect(firstDueOnOrAfter("2026-01-12", "2026-12-01", "2026-12-12")).toBe("2027-01-12");
  });
});

describe("agreementState", () => {
  it("is ok, ending soon or expired", () => {
    expect(agreementState("2026-12-31", "2026-10-10", 30)).toEqual({ kind: "ok", days: 82 });
    expect(agreementState("2026-10-30", "2026-10-10", 30)).toEqual({ kind: "ending", days: 20 });
    expect(agreementState("2026-10-10", "2026-10-10", 30)).toEqual({ kind: "ending", days: 0 });
    expect(agreementState("2026-10-05", "2026-10-10", 30)).toEqual({ kind: "expired", days: 5 });
  });
});

describe("inLockIn", () => {
  it("includes the last lock-in day", () => {
    expect(inLockIn("2026-06-30", "2026-06-30")).toBe(true);
    expect(inLockIn("2026-06-30", "2026-07-01")).toBe(false);
    expect(inLockIn(null, "2026-01-01")).toBe(false);
  });
});
