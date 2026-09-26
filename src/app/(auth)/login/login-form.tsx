"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        label="Mobile number"
        name="mobile"
        type="tel"
        inputMode="numeric"
        autoComplete="username"
        placeholder="98765 43210"
        defaultValue={state.mobile}
        error={state.fieldErrors?.mobile}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />
      <SubmitButton pending={pending}>Log in</SubmitButton>
      <p className="text-center text-sm text-stone-500">
        Forgot your password? Ask your business owner to reset it.
      </p>
    </form>
  );
}
