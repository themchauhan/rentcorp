"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import {
  itemFormSchema,
  type ItemFormField,
  type ItemFormInput,
  type ItemFormValues,
} from "@/lib/items";
import { createClient } from "@/lib/supabase/server";

export type ItemFormState = {
  error?: string;
  fieldErrors?: Partial<Record<ItemFormField, string>>;
  values?: ItemFormInput;
};

export type ItemStatusState = { error?: string; done?: string };

const DUPLICATE_NAME = "You already have an item with this name";

function readForm(formData: FormData): ItemFormInput {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    name: get("name"),
    category: get("category"),
    unitLabel: get("unitLabel"),
    quantity: get("quantity"),
    price: get("price"),
    rateUnit: get("rateUnit") as ItemFormInput["rateUnit"],
  };
}

function validate(
  values: ItemFormInput,
): { ok: true; data: ItemFormValues } | { ok: false; state: ItemFormState } {
  const parsed = itemFormSchema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors = z.flattenError(parsed.error).fieldErrors as Partial<
    Record<ItemFormField, string[]>
  >;
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).map(([k, v]) => [k, v?.[0]]),
  ) as ItemFormState["fieldErrors"];
  return { ok: false, state: { values, fieldErrors } };
}

// Columns written from the form. tenant_id is never among them: the
// database sets it from the session.
const toRow = (d: ItemFormValues) => ({
  name: d.name,
  category: d.category,
  unit_label: d.unitLabel,
  total_quantity_owned: d.quantity,
  rate_paise: d.price,
  rate_unit: d.rateUnit,
});

export async function createItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireTenantAdmin();
  const values = readForm(formData);
  const result = validate(values);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rental_items")
    .insert(toRow(result.data))
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { values, fieldErrors: { name: DUPLICATE_NAME } };
    console.error("createItem failed:", error.message);
    return { values, error: "Couldn't save the item. Please try again." };
  }

  await logAudit("item.created", "rental_item", data.id, {
    name: result.data.name,
    rate_paise: result.data.price,
    rate_unit: result.data.rateUnit,
  });
  revalidatePath("/items");
  redirect("/items");
}

export async function updateItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireTenantAdmin();
  const values = readForm(formData);
  const id = z.uuid().safeParse(formData.get("itemId"));
  if (!id.success) return { values, error: "Item not found." };
  const result = validate(values);
  if (!result.ok) return result.state;

  const supabase = await createClient();
  // Loaded through the owner's session: another business's item is invisible.
  const { data: before } = await supabase
    .from("rental_items")
    .select("name, category, unit_label, total_quantity_owned, rate_paise, rate_unit")
    .eq("id", id.data)
    .maybeSingle();
  if (!before) return { values, error: "Item not found." };

  const row = toRow(result.data);
  const { data: updated, error } = await supabase
    .from("rental_items")
    .update(row)
    .eq("id", id.data)
    .select("id");
  if (error) {
    if (error.code === "23505") return { values, fieldErrors: { name: DUPLICATE_NAME } };
    console.error("updateItem failed:", error.message);
    return { values, error: "Couldn't save the item. Please try again." };
  }
  if (!updated?.length) return { values, error: "Item not found." };

  const changes = Object.fromEntries(
    (Object.keys(row) as (keyof typeof row)[])
      .filter((k) => before[k] !== row[k])
      .map((k) => [k, { from: before[k], to: row[k] }]),
  );
  if (Object.keys(changes).length) {
    await logAudit("item.updated", "rental_item", id.data, { changes });
  }
  revalidatePath("/items");
  redirect("/items");
}

export async function setItemActive(
  _prev: ItemStatusState,
  formData: FormData,
): Promise<ItemStatusState> {
  await requireTenantAdmin();
  const id = z.uuid().safeParse(formData.get("itemId"));
  if (!id.success) return { error: "Item not found." };
  const active = formData.get("active") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rental_items")
    .update({ active })
    .eq("id", id.data)
    .select("id");
  if (error) return { error: "Couldn't update the item. Please try again." };
  if (!data?.length) return { error: "Item not found." };

  await logAudit(active ? "item.reactivated" : "item.deactivated", "rental_item", id.data);
  revalidatePath("/items");
  revalidatePath(`/items/${id.data}`);
  return { done: active ? "Item is active again." : "Item deactivated." };
}
