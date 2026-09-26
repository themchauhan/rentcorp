import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";

/**
 * Appends an audit log entry as the signed-in user. There is deliberately
 * no tenant or user parameter: the database trigger fills both from the
 * session, so they cannot be forged. Throws if the write fails — audit
 * gaps must not be silent.
 *
 * Pass `client` when the caller already holds a client whose session was
 * just established (e.g. right after sign-in in the same request).
 * `tenantId` records which business a platform-admin action concerns; the
 * trigger ignores it for everyone else.
 */
export async function logAudit(
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: { [key: string]: Json | undefined } = {},
  { client, tenantId }: { client?: SupabaseServerClient; tenantId?: string } = {},
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("audit_logs").insert({
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    tenant_id: tenantId ?? null,
  });
  if (error) throw new Error(`Audit log write failed for "${action}": ${error.message}`);
}
