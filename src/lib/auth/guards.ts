import "server-only";
import { notFound, redirect } from "next/navigation";
import { tenantAccess, type BusinessType, type Role, type TenantAccess } from "./access";
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

export type TenantMember = ActiveTenantProfile & {
  /** True when the business's trial/subscription has ended or it's suspended. */
  readOnly: boolean;
  access: TenantAccess;
};

/**
 * Signed-in tenant user (ADMIN/STAFF) with an ACTIVE account. Businesses
 * without access (expired/suspended) still pass, with `readOnly: true`, so
 * they can view their data. Use on pages that only read.
 * Users on a temporary password are sent to /change-password unless
 * `allowTemporaryPassword` is set (only the change-password flow does).
 */
type MemberOptions = {
  allowTemporaryPassword?: boolean;
  /** Only this kind of business may use the page/action; others get 404. */
  type?: BusinessType;
};

export async function requireTenantMember({
  allowTemporaryPassword = false,
  type,
}: MemberOptions = {}): Promise<TenantMember> {
  const profile = await requireUser();
  if (profile.kind !== "tenant") redirect("/admin");
  if (profile.status !== "ACTIVE" || !profile.tenant) redirect("/account-inactive");
  if (profile.mustChangePassword && !allowTemporaryPassword) redirect("/change-password");
  if (type && profile.tenant.business_type !== type) notFound();
  const access = tenantAccess(profile.tenant);
  return { ...(profile as ActiveTenantProfile), readOnly: !access.ok, access };
}

/**
 * Tenant user whose business currently has access — required for every
 * page or action that changes data. Read-only businesses are sent Home,
 * which explains why. (The database enforces the same rule.)
 */
export async function requireActiveTenant(opts: MemberOptions = {}): Promise<TenantMember> {
  const member = await requireTenantMember(opts);
  if (member.readOnly) redirect("/");
  return member;
}

/** Tenant user with the ADMIN (owner) role, else /no-access. `write: false` allows read-only businesses. */
export async function requireTenantAdmin({
  write = true,
  type,
}: { write?: boolean; type?: BusinessType } = {}): Promise<TenantMember & { role: "ADMIN" }> {
  const member = write ? await requireActiveTenant({ type }) : await requireTenantMember({ type });
  if (member.role !== "ADMIN") redirect("/no-access");
  return member as TenantMember & { role: "ADMIN" };
}
