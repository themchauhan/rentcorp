"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form";
import type { ConnectionResult } from "@/lib/whatsapp/connection";
import { saveAutomationSettings } from "./actions";

export function AutomationForm({
  autoBookingDetails,
  eveningReminder,
  disabled,
}: {
  autoBookingDetails: boolean;
  eveningReminder: boolean;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<ConnectionResult, FormData>(
    saveAutomationSettings,
    {},
  );
  const row = "flex min-h-12 items-start gap-3 text-base";
  return (
    <form action={action} className="space-y-3" data-testid="automation-form">
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.done && <FormMessage tone="success">{state.done}</FormMessage>}
      <label className={row}>
        <input
          type="checkbox"
          name="autoBookingDetails"
          defaultChecked={autoBookingDetails}
          className="mt-1 h-5 w-5 accent-brand-700"
        />
        <span>
          Send booking details when a booking is saved
          <span className="block text-xs text-stone-500">
            To customers who agreed to WhatsApp messages.
          </span>
        </span>
      </label>
      <label className={row}>
        <input
          type="checkbox"
          name="eveningReminder"
          defaultChecked={eveningReminder}
          className="mt-1 h-5 w-5 accent-brand-700"
        />
        <span>
          Send the balance every evening at 9 PM
          <span className="block text-xs text-stone-500">
            To every customer who still owes money (items out, overdue, or returned but unpaid),
            until it’s settled.
          </span>
        </span>
      </label>
      <button
        type="submit"
        disabled={pending || disabled}
        className="min-h-12 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white disabled:opacity-60"
      >
        Save
      </button>
    </form>
  );
}
