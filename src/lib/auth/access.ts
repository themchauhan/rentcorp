// Pure access rules, shared by the server guards and unit tests.

export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF";
export type TenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
export type BusinessType = "TENT_HOUSE" | "HOSTEL_PG";

export type TenantForAccess = {
  status: TenantStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
};

export type TenantAccess =
  | { ok: true }
  | { ok: false; reason: "SUSPENDED" | "EXPIRED" | "TRIAL_ENDED" | "SUBSCRIPTION_ENDED" };

/**
 * Whether a tenant's users may use the app right now. A missing end date
 * means "no end date set" (open-ended). Phase 9 adds a read-only mode for
 * blocked tenants; for now they are simply blocked.
 */
export function tenantAccess(tenant: TenantForAccess, now: Date = new Date()): TenantAccess {
  const passed = (iso: string | null) => iso !== null && new Date(iso).getTime() <= now.getTime();

  switch (tenant.status) {
    case "SUSPENDED":
      return { ok: false, reason: "SUSPENDED" };
    case "EXPIRED":
      return { ok: false, reason: "EXPIRED" };
    case "TRIAL":
      return passed(tenant.trial_ends_at) ? { ok: false, reason: "TRIAL_ENDED" } : { ok: true };
    case "ACTIVE":
      return passed(tenant.subscription_ends_at)
        ? { ok: false, reason: "SUBSCRIPTION_ENDED" }
        : { ok: true };
  }
}

/** Where each role lands after signing in. */
export function homePathForRole(role: Role): string {
  return role === "SUPER_ADMIN" ? "/admin" : "/";
}
