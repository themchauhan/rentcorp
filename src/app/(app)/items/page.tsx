import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantMember } from "@/lib/auth/guards";
import { RATE_UNIT_LABEL } from "@/lib/items";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Items" };

type Search = { q?: string; category?: string; inactive?: string };

function hrefWith(current: Search, change: Partial<Search>): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.inactive) params.set("inactive", next.inactive);
  const qs = params.toString();
  return qs ? `/items?${qs}` : "/items";
}

// Escape LIKE wildcards so a search for "50%" matches literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const profile = await requireTenantMember({ type: "TENT_HOUSE" });
  // Owners edit the catalog; read-only businesses only view it.
  const isOwner = profile.role === "ADMIN" && !profile.readOnly;
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const current: Search = {
    q: one(raw.q),
    category: one(raw.category),
    inactive: one(raw.inactive) === "1" ? "1" : undefined,
  };

  const supabase = await createClient();
  let query = supabase
    .from("rental_items")
    .select("id, name, category, unit_label, total_quantity_owned, rate_paise, rate_unit, active")
    .order("category")
    .order("name");
  if (!current.inactive) query = query.eq("active", true);
  if (current.category) query = query.eq("category", current.category);
  if (current.q) query = query.ilike("name", `%${escapeLike(current.q)}%`);
  const { data: items, error } = await query;
  if (error) throw new Error("Couldn't load items");

  const { data: all } = await supabase.from("rental_items").select("category, active");
  const categories = [
    ...new Set((all ?? []).filter((r) => current.inactive || r.active).map((r) => r.category)),
  ].sort((a, b) => a.localeCompare(b));

  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm ${
      active
        ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
        : "border-stone-300 bg-white text-stone-700"
    }`;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Items</h1>
        {isOwner && (
          <Link
            href="/items/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 font-semibold text-white"
          >
            Add item
          </Link>
        )}
      </div>

      <form action="/items" role="search" className="flex gap-2">
        {current.category && <input type="hidden" name="category" value={current.category} />}
        {current.inactive && <input type="hidden" name="inactive" value="1" />}
        <input
          type="search"
          name="q"
          defaultValue={current.q}
          placeholder="Search items"
          aria-label="Search items"
          className="block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Search
        </button>
      </form>

      <nav aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={hrefWith(current, { category: undefined })} className={chip(!current.category)}>
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={hrefWith(current, { category: c })}
            className={chip(current.category === c)}
          >
            {c}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
        <Link
          href={hrefWith(current, { inactive: current.inactive ? undefined : "1" })}
          className="font-medium text-brand-700"
        >
          {current.inactive ? "Hide inactive" : "Show inactive"}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          {current.q || current.category
            ? "No items match."
            : isOwner
              ? "No items yet. Add your first item."
              : "No items yet. Ask your business owner to add them."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {items.map((item) => {
            const body = (
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">
                    {item.name}
                    {!item.active && (
                      <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-stone-500">
                    {item.category} · {item.total_quantity_owned} {item.unit_label} owned
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-semibold">{formatRupees(item.rate_paise)}</span>
                  <span className="block text-xs text-stone-500">
                    / {item.unit_label} {RATE_UNIT_LABEL[item.rate_unit]}
                  </span>
                </p>
              </div>
            );
            return (
              <li key={item.id} data-testid="item-row">
                {isOwner ? (
                  <Link href={`/items/${item.id}`} className="block hover:bg-stone-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
