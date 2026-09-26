import type { Metadata } from "next";
import Link from "next/link";
import { tenantAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/guards";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { istDateOf } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { CreateBusinessForm } from "./create-business-form";

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
    .select(
      "id, name, status, plan, trial_ends_at, subscription_ends_at, owners:profiles (name, mobile, role)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load businesses");

  const today = todayIST();
  const soon = addDays(today, 7);
  const rows = tenants.map((t) => {
    const end = istDateOf(t.status === "TRIAL" ? t.trial_ends_at : t.subscription_ends_at);
    const access = tenantAccess(t);
    return { t, end, access, endingSoon: access.ok && !!end && end <= soon };
  });
  const count = (s: keyof typeof STATUS_LABEL) => rows.filter((r) => r.t.status === s).length;
  const tiles = [
    ["Businesses", rows.length],
    ["Active", count("ACTIVE")],
    ["Trial", count("TRIAL")],
    ["Suspended", count("SUSPENDED")],
    ["No access", rows.filter((r) => !r.access.ok).length],
    ["Ending in 7 days", rows.filter((r) => r.endingSoon).length],
  ] as const;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Businesses</h1>

      <dl className="grid grid-cols-3 gap-2 text-center" data-testid="admin-counts">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-stone-200 bg-white p-3">
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="text-xl font-bold" data-testid={`count-${label}`}>
              {n}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-2">
        {rows.map(({ t, end, access, endingSoon }) => {
          const owner = t.owners.find((p) => p.role === "ADMIN");
          return (
            <li key={t.id} data-testid="business-row">
              <Link
                href={`/admin/tenants/${t.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{t.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      !access.ok
                        ? "bg-red-100 text-red-800"
                        : endingSoon
                          ? "bg-amber-100 text-amber-800"
                          : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {STATUS_LABEL[t.status]}
                    {!access.ok && t.status !== "SUSPENDED" && t.status !== "EXPIRED"
                      ? " · ended"
                      : ""}
                  </span>
                </div>
                <p className="text-sm text-stone-600">
                  {owner ? `${owner.name} · ${owner.mobile}` : "No owner"}
                  {end ? ` · ends ${formatDate(end)}` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <details className="rounded-2xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-lg font-semibold">New business</summary>
        <div className="mt-4">
          <CreateBusinessForm />
        </div>
      </details>
    </section>
  );
}
