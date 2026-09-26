import "server-only";
import { cache } from "react";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { TenantStatus } from "./access";

export type SessionTenant = {
  id: string;
  name: string;
  status: TenantStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
};

export type SessionProfile =
  | {
      kind: "platform";
      userId: string;
      loginEmail: string | null;
      name: string;
      role: "SUPER_ADMIN";
      tenantId: null;
      tenant: null;
    }
  | {
      kind: "tenant";
      userId: string;
      loginEmail: string | null;
      name: string;
      role: "ADMIN" | "STAFF";
      status: "ACTIVE" | "INACTIVE";
      tenantId: string;
      /** Null when the profile is INACTIVE (RLS hides the tenant). */
      tenant: SessionTenant | null;
    };

/**
 * Loads the profile for an already-verified user id using that user's own
 * session (RLS applies). Returns null if the user has no profile and is
 * not a platform admin.
 */
export async function loadProfile(
  supabase: SupabaseServerClient,
  userId: string,
  loginEmail: string | null,
): Promise<SessionProfile | null> {
  const { data: admin } = await supabase
    .from("platform_admins")
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();

  if (admin) {
    return {
      kind: "platform",
      userId,
      loginEmail,
      name: admin.name,
      role: "SUPER_ADMIN",
      tenantId: null,
      tenant: null,
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "name, role, status, tenant_id, tenant:tenants (id, name, status, trial_ends_at, subscription_ends_at)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (!profile || profile.role === "SUPER_ADMIN") return null;

  return {
    kind: "tenant",
    userId,
    loginEmail,
    name: profile.name,
    role: profile.role,
    status: profile.status,
    tenantId: profile.tenant_id,
    tenant: (profile.tenant as SessionTenant | null) ?? null,
  };
}

/**
 * THE source of the current user's identity, role and tenant_id in app
 * code. Identity comes from the verified Supabase session token, and
 * role/tenant from the database — never from anything the browser sends.
 * Cached per request.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return loadProfile(supabase, userId, email);
});
