"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CustomerFields } from "@/components/customer-fields";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import type { CustomerFormInput } from "@/lib/customers";
import type { CustomerFormState } from "./actions";

export function CustomerForm({
  action,
  initial,
  customerId,
  submitLabel,
  showWhatsAppConsent = false,
}: {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  initial: CustomerFormInput;
  customerId?: string;
  submitLabel: string;
  showWhatsAppConsent?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(action, {});
  const values = state.values ?? initial;
  const saved =
    customerId && state.values && !state.error && !state.fieldErrors && !state.duplicate;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {customerId && <input type="hidden" name="customerId" value={customerId} />}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {saved && <FormMessage tone="success">Saved.</FormMessage>}
      {/* Remount with submitted values so the inputs keep what was typed. */}
      <CustomerFields
        key={JSON.stringify(values)}
        initial={values}
        errors={state.fieldErrors}
        showWhatsAppConsent={showWhatsAppConsent}
      />
      {state.duplicate && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <p>
            A customer with this mobile already exists: <strong>{state.duplicate.name}</strong> (
            {state.duplicate.mobile}).
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/customers/${state.duplicate.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-amber-400 bg-white px-4 font-medium"
            >
              Open existing
            </Link>
            <button
              type="submit"
              name="confirmDuplicate"
              value="1"
              className="min-h-11 rounded-lg bg-amber-700 px-4 font-medium text-white"
            >
              Save anyway
            </button>
          </div>
        </div>
      )}
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
