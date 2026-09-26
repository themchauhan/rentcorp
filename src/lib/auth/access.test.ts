import { describe, expect, it } from "vitest";
import { homePathForRole, tenantAccess, type TenantForAccess } from "./access";

const now = new Date("2026-09-26T12:00:00Z");
const tenant = (t: Partial<TenantForAccess>): TenantForAccess => ({
  status: "ACTIVE",
  trial_ends_at: null,
  subscription_ends_at: null,
  ...t,
});

describe("tenantAccess", () => {
  it("allows an active tenant with no end date", () => {
    expect(tenantAccess(tenant({}), now)).toEqual({ ok: true });
  });

  it("allows an active tenant before its subscription ends", () => {
    expect(tenantAccess(tenant({ subscription_ends_at: "2026-10-01T00:00:00Z" }), now)).toEqual({
      ok: true,
    });
  });

  it("blocks an active tenant whose subscription has ended", () => {
    expect(tenantAccess(tenant({ subscription_ends_at: "2026-09-26T11:59:59Z" }), now)).toEqual({
      ok: false,
      reason: "SUBSCRIPTION_ENDED",
    });
  });

  it("allows a trial before it ends and blocks it after", () => {
    expect(
      tenantAccess(tenant({ status: "TRIAL", trial_ends_at: "2026-09-27T00:00:00Z" }), now),
    ).toEqual({ ok: true });
    expect(
      tenantAccess(tenant({ status: "TRIAL", trial_ends_at: "2026-09-26T12:00:00Z" }), now),
    ).toEqual({ ok: false, reason: "TRIAL_ENDED" });
  });

  it("blocks suspended and expired tenants regardless of dates", () => {
    const future = "2030-01-01T00:00:00Z";
    expect(
      tenantAccess(tenant({ status: "SUSPENDED", subscription_ends_at: future }), now),
    ).toEqual({ ok: false, reason: "SUSPENDED" });
    expect(tenantAccess(tenant({ status: "EXPIRED", subscription_ends_at: future }), now)).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });
});

describe("homePathForRole", () => {
  it("sends super admins to the platform dashboard and tenant users home", () => {
    expect(homePathForRole("SUPER_ADMIN")).toBe("/admin");
    expect(homePathForRole("ADMIN")).toBe("/");
    expect(homePathForRole("STAFF")).toBe("/");
  });
});
