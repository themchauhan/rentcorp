"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.success && <FormMessage tone="success">{state.success}</FormMessage>}
      <Field
        label="Current password"
        name="current"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.current}
        required
      />
      <Field
        label="New password"
        name="next"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.next}
        required
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
        required
      />
      <SubmitButton pending={pending}>Change password</SubmitButton>
    </form>
  );
}
