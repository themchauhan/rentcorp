import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantMember } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Complaints" };

const STATUS_TONE = {
  OPEN: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
} as const;

export default async function ComplaintsPage({ searchParams }: PageProps<"/complaints">) {
  const profile = await requireTenantMember({ type: "HOSTEL_PG" });
  const show = (await searchParams).show === "resolved" ? "resolved" : "open";
  const supabase = await createClient();
  let q = supabase
    .from("pg_complaints")
    .select(
      "id, category, priority, description, status, raised_at, resolved_at, room:pg_rooms (name), stay:pg_stays (customer:rental_customers (name))",
    )
    .order("raised_at", { ascending: false })
    .limit(100);
  q = show === "resolved" ? q.eq("status", "RESOLVED") : q.neq("status", "RESOLVED");
  const { data: rows, error } = await q;
  if (error) throw new Error("Couldn't load complaints");
  const list = [...(rows ?? [])].sort(
    (a, b) => Number(b.priority === "URGENT") - Number(a.priority === "URGENT"),
  );

  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm ${
      active
        ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
        : "border-stone-300 bg-white text-stone-700"
    }`;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Complaints</h1>
        {!profile.readOnly && (
          <Link
            href="/complaints/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            New complaint
          </Link>
        )}
      </div>
      <nav aria-label="Show" className="flex gap-2">
        <Link href="/complaints" className={chip(show === "open")}>
          Open
        </Link>
        <Link href="/complaints?show=resolved" className={chip(show === "resolved")}>
          Resolved
        </Link>
      </nav>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          {show === "open" ? "No open complaints." : "Nothing resolved yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} data-testid="complaint-row">
              <Link
                href={`/complaints/${c.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {COMPLAINT_CATEGORY_LABEL[c.category]}
                      {c.room ? ` · Room ${c.room.name}` : ""}
                      {c.priority === "URGENT" && (
                        <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Urgent
                        </span>
                      )}
                    </p>
                    <p className="line-clamp-2 text-sm text-stone-600">{c.description}</p>
                    <p className="text-xs text-stone-500">
                      {c.stay?.customer?.name ? `${c.stay.customer.name} · ` : ""}
                      {formatDate(c.raised_at.slice(0, 10))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status]}`}
                  >
                    {COMPLAINT_STATUS_LABEL[c.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
