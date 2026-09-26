import { describe, expect, it } from "vitest";
import { addMonths, endOfIstDay, extendedEnd, istDateOf } from "./subscriptions";

describe("subscription dates", () => {
  it("stores ends as the last moment of the IST day", () => {
    expect(endOfIstDay("2026-10-12")).toBe("2026-10-12T23:59:59.999+05:30");
    expect(istDateOf("2026-10-12T18:29:59.999Z")).toBe("2026-10-12");
  });
  it("adds months, clamping to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-09-26", 12)).toBe("2027-09-26");
  });
  it("extends from the current end if still running, else from today", () => {
    expect(extendedEnd("2026-10-12T23:59:59.999+05:30", 1, "2026-09-26")).toBe("2026-11-12");
    // Expired: a month starting today (ends the day before the same date next month).
    expect(extendedEnd("2026-09-01T23:59:59.999+05:30", 1, "2026-09-26")).toBe("2026-10-25");
    expect(extendedEnd(null, 12, "2026-09-26")).toBe("2027-09-25");
  });
});
