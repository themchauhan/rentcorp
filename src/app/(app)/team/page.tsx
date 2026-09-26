import type { Metadata } from "next";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AddStaffForm } from "./add-staff-form";
import { StaffRow } from "./staff-row";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireTenantAdmin();
  const supabase = await createClient();
  // RLS limits this to the owner's own business.
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, name, mobile, status")
    .eq("role", "STAFF")
    .order("status")
    .order("name");
  if (error) throw new Error("Couldn't load team");

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Team</h1>
        <p className="mt-1 text-stone-600">Add staff and manage their logins.</p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">Add staff</h2>
        <AddStaffForm />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Staff ({staff.length})</h2>
        {staff.length === 0 ? (
          <p className="text-stone-600">No staff yet.</p>
        ) : (
          <ul className="space-y-3">
            {staff.map((s) => (
              <StaffRow key={s.id} staff={s} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
