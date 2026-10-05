"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireActiveTenant } from "@/lib/auth/guards";
import {
  parseCustomer,
  readCustomerForm,
  type CustomerFormField,
  type CustomerFormInput,
} from "@/lib/customers";
import {
  findDuplicateCustomer,
  insertCustomer,
  type DuplicateCustomer,
} from "@/lib/customers-server";
import { createClient } from "@/lib/supabase/server";

export type CustomerFormState = {
  error?: string;
  fieldErrors?: Partial<Record<CustomerFormField, string>>;
  values?: CustomerFormInput;
  duplicate?: DuplicateCustomer;
};

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireActiveTenant({ type: "TENT_HOUSE" });
  const values = readCustomerForm(formData);
  const parsed = parseCustomer(values);
  if (!parsed.ok) return { values, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  if (formData.get("confirmDuplicate") !== "1") {
    const duplicate = await findDuplicateCustomer(supabase, parsed.row);
    if (duplicate) return { values, duplicate };
  }

  const id = await insertCustomer(supabase, parsed.row);
  if (!id) return { values, error: "Couldn't save the customer. Please try again." };
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function updateCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const member = await requireActiveTenant({ type: "TENT_HOUSE" });
  const values = readCustomerForm(formData);
  const id = z.uuid().safeParse(formData.get("customerId"));
  if (!id.success) return { values, error: "Customer not found." };
  const parsed = parseCustomer(values);
  if (!parsed.ok) return { values, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("rental_customers")
    .select("name, mobile, whatsapp_number, preferred_channel, address, whatsapp_opt_in")
    .eq("id", id.data)
    .maybeSingle();
  if (!before) return { values, error: "Customer not found." };

  // Without the WhatsApp add-on the consent box isn't shown: keep what's saved.
  if (!member.tenant.whatsapp_addon) parsed.row.whatsapp_opt_in = before.whatsapp_opt_in;

  if (formData.get("confirmDuplicate") !== "1" && before.mobile !== parsed.row.mobile) {
    const duplicate = await findDuplicateCustomer(supabase, parsed.row, id.data);
    if (duplicate) return { values, duplicate };
  }

  const { data: updated, error } = await supabase
    .from("rental_customers")
    .update(parsed.row)
    .eq("id", id.data)
    .select("id");
  if (error) return { values, error: "Couldn't save the customer. Please try again." };
  if (!updated?.length) return { values, error: "Customer not found." };

  const row = parsed.row;
  const changes = Object.fromEntries(
    (Object.keys(row) as (keyof typeof row)[])
      .filter((k) => before[k] !== row[k])
      .map((k) => [k, { from: before[k], to: row[k] }]),
  );
  if (Object.keys(changes).length) {
    await logAudit("customer.updated", "rental_customer", id.data, { changes });
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${id.data}`);
  return { values };
}
