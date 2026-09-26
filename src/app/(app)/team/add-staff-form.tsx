"use client";

import { useActionState } from "react";
import { TempPasswordNotice } from "@/components/temp-password-notice";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { addStaff, type AddStaffState } from "./actions";

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState<AddStaffState, FormData>(addStaff, {});

  return (
    <div className="space-y-4">
      {state.issued && <TempPasswordNotice {...state.issued} />}
      <form action={formAction} className="space-y-4" noValidate>
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <Field
          label="Staff name"
          name="name"
          autoComplete="off"
          defaultValue={state.issued ? "" : state.values?.name}
          key={state.issued ? `n-${state.issued.mobile}` : "n"}
          error={state.fieldErrors?.name}
          required
        />
        <Field
          label="Mobile number"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={state.issued ? "" : state.values?.mobile}
          key={state.issued ? `m-${state.issued.mobile}` : "m"}
          error={state.fieldErrors?.mobile}
          required
        />
        <SubmitButton pending={pending}>Add staff</SubmitButton>
      </form>
    </div>
  );
}
