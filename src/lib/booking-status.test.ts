import { describe, expect, it } from "vitest";
import { daysOverdue, effectiveStatus } from "./booking-status";

describe("effectiveStatus", () => {
  it("marks an open booking overdue the day after its return date", () => {
    expect(effectiveStatus("ACTIVE", "2026-10-14", "2026-10-14")).toBe("ACTIVE");
    expect(effectiveStatus("ACTIVE", "2026-10-14", "2026-10-15")).toBe("OVERDUE");
    expect(effectiveStatus("PARTIALLY_RETURNED", "2026-10-14", "2026-10-20")).toBe("OVERDUE");
  });
  it("never marks finished bookings overdue", () => {
    expect(effectiveStatus("RETURNED", "2026-10-14", "2026-10-20")).toBe("RETURNED");
    expect(effectiveStatus("CANCELLED", "2026-10-14", "2026-10-20")).toBe("CANCELLED");
  });
  it("counts days overdue", () => {
    expect(daysOverdue("2026-10-14", "2026-10-14")).toBe(0);
    expect(daysOverdue("2026-10-14", "2026-10-17")).toBe(3);
  });
});
