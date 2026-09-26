import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantMember } from "@/lib/auth/guards";
import { normalizeIndianMobile } from "@/lib/auth/mobile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers" };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() || "";

  const { readOnly } = await requireTenantMember();
  const supabase = await createClient();
  let query = supabase
    .from("rental_customers")
    .select("id, name, mobile, whatsapp_number, preferred_channel")
    .order("name")
    .limit(200);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const mobile = normalizeIndianMobile(q);
    query = mobile
      ? query.eq("mobile", mobile)
      : digits.length >= 3 && digits.length === q.replace(/\s/g, "").length
        ? query.like("mobile", `%${digits}%`)
        : query.ilike("name", `%${escapeLike(q)}%`);
  }
  const { data: customers, error } = await query;
  if (error) throw new Error("Couldn't load customers");

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Customers</h1>
        {!readOnly && (
          <Link
            href="/customers/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            Add customer
          </Link>
        )}
      </div>

      <form action="/customers" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name or mobile"
          aria-label="Search customers"
          className="block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          {q ? "No customers match." : "No customers yet."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {customers.map((c) => (
            <li key={c.id} data-testid="customer-row">
              <Link
                href={`/customers/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="font-mono text-sm text-stone-600">{c.mobile}</span>
                </span>
                <span className="shrink-0 text-xs text-stone-500">
                  {c.whatsapp_number ? "WhatsApp" : "SMS only"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
