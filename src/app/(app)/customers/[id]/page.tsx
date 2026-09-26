import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { requireTenantMember } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { readOnly } = await requireTenantMember();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("rental_customers")
    .select("id, name, mobile, whatsapp_number, preferred_channel, address")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const { data: bookings } = await supabase
    .from("rental_orders")
    .select("id, booking_number, status, event_start_date, expected_return_date")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <Link href="/customers" className="text-sm font-medium text-brand-700">
          ← Customers
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-900">{c.name}</h1>
          {!readOnly && (
            <Link
              href={`/bookings/new?customer=${c.id}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
            >
              New booking
            </Link>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Bookings</h2>
        {bookings?.length ? (
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                >
                  <span>
                    <span className="font-semibold">#{b.booking_number}</span>{" "}
                    <span className="text-sm text-stone-600">
                      {formatDate(b.event_start_date)} → {formatDate(b.expected_return_date)}
                    </span>
                  </span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-600">No bookings yet.</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        {readOnly ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-stone-500">Mobile</dt>
            <dd>{c.mobile}</dd>
            <dt className="text-stone-500">WhatsApp</dt>
            <dd>{c.whatsapp_number ?? "Not on WhatsApp"}</dd>
            <dt className="text-stone-500">Address</dt>
            <dd>{c.address ?? "—"}</dd>
          </dl>
        ) : (
          <CustomerForm
            action={updateCustomer}
            customerId={c.id}
            submitLabel="Save changes"
            initial={{
              name: c.name,
              mobile: c.mobile,
              whatsappNumber:
                c.whatsapp_number && c.whatsapp_number !== c.mobile ? c.whatsapp_number : "",
              notOnWhatsapp: !c.whatsapp_number,
              preferredChannel: c.preferred_channel,
              address: c.address ?? "",
            }}
          />
        )}
      </div>
    </section>
  );
}
