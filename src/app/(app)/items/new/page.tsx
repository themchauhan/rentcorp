import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { categoryOptions } from "@/lib/items-query";
import { createClient } from "@/lib/supabase/server";
import { createItem } from "../actions";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage() {
  await requireTenantAdmin({ type: "TENT_HOUSE" });
  const categories = await categoryOptions(await createClient());

  return (
    <section className="max-w-lg">
      <Link href="/items" className="text-sm font-medium text-brand-700">
        ← Items
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-stone-900">Add item</h1>
      <ItemForm
        action={createItem}
        categories={categories}
        submitLabel="Save item"
        initial={{
          name: "",
          category: "",
          unitLabel: "piece",
          quantity: "",
          price: "",
          rateUnit: "PER_DAY",
        }}
      />
    </section>
  );
}
