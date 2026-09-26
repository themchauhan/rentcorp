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
        <SubmitButton pending={pending}>Create business</SubmitButton>
      </form>
    </div>
  );
}
