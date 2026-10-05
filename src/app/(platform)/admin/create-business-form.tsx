"use client";

import { useActionState } from "react";
import { TempPasswordNotice } from "@/components/temp-password-notice";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { createBusiness, type CreateBusinessState } from "./actions";

export function CreateBusinessForm() {
  const [state, formAction, pending] = useActionState<CreateBusinessState, FormData>(
    createBusiness,
    {},
  );
  // Clear the inputs after a successful create by remounting them.
  const formKey = state.issued ? `done-${state.issued.mobile}` : "form";
  const v = state.issued ? undefined : state.values;

  return (
    <div className="space-y-4">
      {state.issued && (
        <>
          <p className="font-medium text-green-800">
            Created {state.issued.businessName}. Give the owner their login:
          </p>
          <TempPasswordNotice {...state.issued} />
        </>
      )}
      <form key={formKey} action={formAction} className="space-y-4" noValidate>
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <Field
          label="Business name"
          name="businessName"
          defaultValue={v?.businessName}
          error={state.fieldErrors?.businessName}
          required
        />
        <Field
          label="Business phone (optional)"
          name="businessPhone"
          type="tel"
          inputMode="numeric"
          defaultValue={v?.businessPhone}
          error={state.fieldErrors?.businessPhone}
        />
        <Field
          label="Owner name"
          name="ownerName"
          defaultValue={v?.ownerName}
          error={state.fieldErrors?.ownerName}
          required
        />
        <Field
          label="Owner mobile number"
          name="ownerMobile"
          type="tel"
          inputMode="numeric"
          defaultValue={v?.ownerMobile}
          error={state.fieldErrors?.ownerMobile}
          required
        />
        <fieldset>
          <legend className="block text-sm font-medium text-stone-700">Type of business</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <label className="flex min-h-12 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-base has-checked:border-brand-600 has-checked:bg-brand-50">
              <input
                type="radio"
                name="businessType"
                value="TENT_HOUSE"
                defaultChecked
                className="h-5 w-5 accent-brand-700"
              />
              Tent house
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-base has-checked:border-brand-600 has-checked:bg-brand-50">
              <input
                type="radio"
                name="businessType"
                value="HOSTEL_PG"
                className="h-5 w-5 accent-brand-700"
              />
              Hostel / PG
            </label>
          </div>
          <p className="mt-1 text-xs text-stone-500">Can&apos;t be changed later.</p>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input type="checkbox" name="isTest" className="h-5 w-5 accent-brand-700" />
          Test business (can be permanently deleted later)
        </label>
        <SubmitButton pending={pending}>Create business</SubmitButton>
      </form>
    </div>
  );
}
