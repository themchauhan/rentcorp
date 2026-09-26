import type { Metadata } from "next";
import Link from "next/link";
import { emptyCustomerForm } from "@/lib/customers";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <section className="max-w-lg">
      <Link href="/customers" className="text-sm font-medium text-brand-700">
        ← Customers
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-stone-900">Add customer</h1>
      <CustomerForm
        action={createCustomer}
        initial={emptyCustomerForm}
        submitLabel="Save customer"
      />
    </section>
  );
}
