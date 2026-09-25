import { describe, expect, it } from "vitest";
import { isActivePath, navItems } from "./nav";

describe("isActivePath", () => {
  it("matches home only on the exact root path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/bookings", "/")).toBe(false);
  });

  it("matches a section and its sub-routes", () => {
    expect(isActivePath("/bookings", "/bookings")).toBe(true);
    expect(isActivePath("/bookings/123", "/bookings")).toBe(true);
  });

  it("does not match a different section sharing a prefix", () => {
    expect(isActivePath("/bookingsarchive", "/bookings")).toBe(false);
    expect(isActivePath("/items", "/bookings")).toBe(false);
  });
});

describe("navItems", () => {
  it("fits a phone bottom bar (at most 5 items) with unique hrefs", () => {
    expect(navItems.length).toBeLessThanOrEqual(5);
    expect(new Set(navItems.map((i) => i.href)).size).toBe(navItems.length);
  });
});
