import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Secret-key client. BYPASSES RLS. The only module allowed to read
 * SUPABASE_SECRET_KEY (project rule 4). Use it solely for account
 * administration (Auth admin API, service-role-only SQL functions), and
 * only after the caller has been authorised with the session guards.
 * Tenant data reads/writes must use the user's session client instead.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing environment variable SUPABASE_SECRET_KEY");

  return createClient<Database>(publicEnv.supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
