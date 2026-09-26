"use server";

import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const profile = await getSessionProfile();
  // Inactive users can't write audit rows (by design); skip rather than fail.
  const canAudit =
    profile && (profile.kind === "platform" || (profile.status === "ACTIVE" && profile.tenant));
  if (canAudit) await logAudit("auth.logout", "user", profile.userId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
