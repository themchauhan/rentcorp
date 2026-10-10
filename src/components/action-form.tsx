"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form";

type State = { error?: string; done?: string };

/**
 * A small form around one server action: hidden fields, optional inputs
 * (children), a submit button and the action's result message.
 */
export function ActionForm({
  action,
  hidden = {},
  label,
  pendingLabel = "Please wait…",
  tone = "primary",
  confirm,
  children,
  className = "space-y-3",
  testId,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  hidden?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  /** Ask before submitting (browser confirm). */
  confirm?: string;
  children?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const button = {
    primary: "bg-brand-700 font-semibold text-white hover:bg-brand-800",
    secondary: "border border-stone-300 bg-white font-medium text-stone-800 hover:bg-stone-50",
    danger: "border border-red-300 bg-white font-medium text-red-700 hover:bg-red-50",
  }[tone];
  return (
    <form
      action={formAction}
      // The server checks every value and explains in plain words.
      noValidate
      className={className}
      data-testid={testId}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.done && <FormMessage tone="success">{state.done}</FormMessage>}
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`min-h-11 w-full rounded-lg px-4 disabled:opacity-60 ${button}`}
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
