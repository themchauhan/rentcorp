import "server-only";
import { redirect } from "next/navigation";
import { tenantAccess, type Role } from "./access";
import { getSessionProfile, type SessionProfile } from "./session";

type TenantProfile = Extract<SessionProfile, { kind: "tenant" }>;

/** Signed-in user with a profile, else redirect to /login. */
export async function requireUser(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Signed-in user whose role is one of `roles`, else /no-access. */
export async function requireRole<R extends Role>(
  ...roles: R[]
): Promise<Extract<SessionProfile, { role: R }>> {
  const profile = await requireUser();
  if (!(roles as Role[]).includes(profile.role)) redirect("/no-access");
  return profile as Extract<SessionProfile, { role: R }>;
}

/**
 * Tenant user (ADMIN/STAFF) whose own account is ACTIVE and whose business
 * currently has access. Use on every tenant route and server action.
 */
export async function requireActiveTenant(): Promise<
  TenantProfile & { status: "ACTIVE"; tenant: NonNullable<TenantProfile["tenant"]> }
> {
  const profile = await requireUser();
  if (profile.kind !== "tenant") redirect("/admin");
  if (profile.status !== "ACTIVE" || !profile.tenant) redirect("/account-inactive");
  if (!tenantAccess(profile.tenant).ok) redirect("/account-inactive");
  return profile as TenantProfile & {
    status: "ACTIVE";
    tenant: NonNullable<TenantProfile["tenant"]>;
  };
}
