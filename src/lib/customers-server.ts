import "server-only";
import { logAudit } from "@/lib/audit";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerRow } from "./customers";

export type DuplicateCustomer = { id: string; name: string; mobile: string };

/** Existing customer of this business with the same mobile, if any (RLS-scoped). */
export async function findDuplicateCustomer(
  supabase: SupabaseServerClient,
  row: CustomerRow,
  excludeId?: string,
): Promise<DuplicateCustomer | null> {
  let q = supabase
    .from("rental_customers")
    .select("id, name, mobile")
    .eq("mobile", row.mobile)
    .order("created_at")
    .limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return data?.[0] ?? null;
}

/** Inserts a customer through the user's session; tenant comes from the session. */
export async function insertCustomer(
  supabase: SupabaseServerClient,
  row: CustomerRow,
): Promise<string | null> {
  const { data, error } = await supabase.from("rental_customers").insert(row).select("id").single();
  if (error) {
    console.error("insertCustomer failed:", error.message);
    return null;
  }
  await logAudit(
    "customer.created",
    "rental_customer",
    data.id,
    { name: row.name, mobile: row.mobile },
    { client: supabase },
  );
  return data.id;
}
