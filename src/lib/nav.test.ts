import { describe, expect, it } from "vitest";
import { isActivePath, isNavItemActive, navItems } from "./nav";

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

describe("isNavItemActive", () => {
  const more = navItems.find((i) => i.label === "More")!;
  it("keeps More highlighted on the pages opened from it", () => {
    for (const p of ["/more", "/more/password", "/reports", "/team", "/settings/messages"]) {
      expect(isNavItemActive(p, more), p).toBe(true);
    }
    expect(isNavItemActive("/bookings", more)).toBe(false);
  });
});

describe("navItems", () => {
  it("fits a phone bottom bar (at most 5 items) with unique hrefs", () => {
    expect(navItems.length).toBeLessThanOrEqual(5);
    expect(new Set(navItems.map((i) => i.href)).size).toBe(navItems.length);
  });
});
