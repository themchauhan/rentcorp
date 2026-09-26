"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import type { PasswordState } from "@/lib/auth/change-password";

export function PasswordForm({
  action,
  currentLabel = "Current password",
  submitLabel = "Change password",
}: {
  action: (prev: PasswordState, formData: FormData) => Promise<PasswordState>;
  currentLabel?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.success && <FormMessage tone="success">{state.success}</FormMessage>}
      <Field
        label={currentLabel}
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
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
