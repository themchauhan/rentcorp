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

type ActiveTenantProfile = TenantProfile & {
  status: "ACTIVE";
  tenant: NonNullable<TenantProfile["tenant"]>;
};

/**
 * Tenant user (ADMIN/STAFF) whose own account is ACTIVE and whose business
 * currently has access. Use on every tenant route and server action.
 * Users still on a temporary password are sent to /change-password unless
 * `allowTemporaryPassword` is set (only the change-password flow does).
 */
export async function requireActiveTenant({
  allowTemporaryPassword = false,
}: { allowTemporaryPassword?: boolean } = {}): Promise<ActiveTenantProfile> {
  const profile = await requireUser();
  if (profile.kind !== "tenant") redirect("/admin");
  if (profile.status !== "ACTIVE" || !profile.tenant) redirect("/account-inactive");
  if (!tenantAccess(profile.tenant).ok) redirect("/account-inactive");
  if (profile.mustChangePassword && !allowTemporaryPassword) redirect("/change-password");
  return profile as ActiveTenantProfile;
}

/** Active tenant user with the ADMIN (owner) role, else /no-access. */
export async function requireTenantAdmin(): Promise<ActiveTenantProfile & { role: "ADMIN" }> {
  const profile = await requireActiveTenant();
  if (profile.role !== "ADMIN") redirect("/no-access");
  return profile as ActiveTenantProfile & { role: "ADMIN" };
}
