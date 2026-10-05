import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { FormMessage } from "@/components/ui/form";
import { requireTenantMember } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";
import { updateComplaint } from "../actions";

export const metadata: Metadata = { title: "Complaint" };

const TONE = {
  OPEN: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
} as const;

export default async function ComplaintPage({
  params,
  searchParams,
}: PageProps<"/complaints/[id]">) {
  const profile = await requireTenantMember({ type: "HOSTEL_PG" });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const created = (await searchParams).created === "1";
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("pg_complaints")
    .select(
      "id, category, priority, description, status, resolution_note, raised_by, raised_at, resolved_by, resolved_at, room:pg_rooms (name), stay:pg_stays (id, customer:rental_customers (name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const { data: people } = await supabase.from("profiles").select("id, name");
  const nameOf = (uid: string | null) => (people ?? []).find((p) => p.id === uid)?.name ?? "—";
  const when = (ts: string) => formatDate(ts.slice(0, 10));

  return (
    <section className="max-w-lg space-y-5">
      <div>
        <BackLink href="/complaints" label="Complaints" />
        <h1 className="mt-2 text-2xl font-bold text-stone-900">
          {COMPLAINT_CATEGORY_LABEL[c.category]}
          {c.room ? ` · Room ${c.room.name}` : ""}
        </h1>
        <p className="mt-1 text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[c.status]}`}
            data-testid="complaint-status"
          >
            {COMPLAINT_STATUS_LABEL[c.status]}
          </span>
          {c.priority === "URGENT" && (
            <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              Urgent
            </span>
          )}
        </p>
      </div>
      {created && <FormMessage tone="success">Complaint saved.</FormMessage>}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="whitespace-pre-wrap">{c.description}</p>
        <p className="mt-3 text-sm text-stone-600">
          Raised {when(c.raised_at)} by {nameOf(c.raised_by)}
          {c.stay?.customer?.name && (
            <>
              {" "}
              for{" "}
              <Link href={`/residents/${c.stay.id}`} className="text-brand-700">
                {c.stay.customer.name}
              </Link>
            </>
          )}
        </p>
        {c.resolved_at && (
          <p className="text-sm text-stone-600">
            Resolved {when(c.resolved_at)} by {nameOf(c.resolved_by)}
          </p>
        )}
        {c.resolution_note && <p className="mt-2 text-sm">Note: {c.resolution_note}</p>}
      </div>
      {!profile.readOnly && (
        <div className="space-y-3">
          {c.status === "OPEN" && (
            <ActionForm
              action={updateComplaint}
              hidden={{ complaintId: c.id, status: "IN_PROGRESS" }}
              label="Mark in progress"
              tone="secondary"
            />
          )}
          {c.status !== "RESOLVED" ? (
            <ActionForm
              action={updateComplaint}
              hidden={{ complaintId: c.id, status: "RESOLVED" }}
              label="Mark resolved"
            >
              <div>
                <label htmlFor="note" className="block text-sm font-medium text-stone-700">
                  What was done (optional)
                </label>
                <input
                  id="note"
                  name="note"
                  maxLength={500}
                  className="mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base"
                />
              </div>
            </ActionForm>
          ) : (
            <ActionForm
              action={updateComplaint}
              hidden={{ complaintId: c.id, status: "OPEN" }}
              label="Reopen"
              tone="secondary"
            />
          )}
        </div>
      )}
    </section>
  );
}
