import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { categoryOptions } from "@/lib/items-query";
import { paiseToRupeesInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { updateItem } from "../actions";
import { ItemForm } from "../item-form";
import { StatusToggle } from "./status-toggle";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: PageProps<"/items/[id]">) {
  await requireTenantAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  // RLS: another business's item simply isn't found.
  const { data: item } = await supabase
    .from("rental_items")
    .select("id, name, category, unit_label, total_quantity_owned, rate_paise, rate_unit, active")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();
  const categories = await categoryOptions(supabase);

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <Link href="/items" className="text-sm font-medium text-brand-700">
          ← Items
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold text-stone-900">Edit item</h1>
        {!item.active && (
          <p className="text-sm font-medium text-stone-500">This item is deactivated.</p>
        )}
      </div>
      <ItemForm
        action={updateItem}
        itemId={item.id}
        categories={categories}
        submitLabel="Save changes"
        initial={{
          name: item.name,
          category: item.category,
          unitLabel: item.unit_label,
          quantity: String(item.total_quantity_owned),
          price: paiseToRupeesInput(item.rate_paise),
          rateUnit: item.rate_unit,
        }}
      />
      <p className="text-sm text-stone-500">
        Changing the price only affects new bookings. Existing bookings keep the price they were
        made with.
      </p>
      <div className="border-t border-stone-200 pt-6">
        <StatusToggle itemId={item.id} active={item.active} />
      </div>
    </section>
  );
}
