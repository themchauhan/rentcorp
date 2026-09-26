import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CreateBusinessForm } from "./create-business-form";
import { ResetOwnerButton } from "./reset-owner-button";

export const metadata: Metadata = { title: "Platform admin" };

const STATUS_LABEL = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
} as const;

export default async function PlatformAdminPage() {
  await requireRole("SUPER_ADMIN");
  const supabase = await createClient();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, status, owners:profiles (id, name, mobile, role)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load businesses");

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Businesses</h1>
        <p className="mt-1 text-stone-600">
          Create a business and its owner login. Subscriptions and plans come in Phase 9.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-semibold">New business</h2>
        <CreateBusinessForm />
      </div>

      <ul className="space-y-3">
        {tenants.map((t) => {
          const owners = t.owners.filter((p) => p.role === "ADMIN");
          return (
            <li
              key={t.id}
              className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
              data-testid="business-row"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{t.name}</p>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              {owners.map((o) => (
                <div key={o.id} className="space-y-2">
                  <p className="text-sm text-stone-600">
                    Owner: {o.name} · <span className="font-mono">{o.mobile}</span>
                  </p>
                  <ResetOwnerButton profileId={o.id} />
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
