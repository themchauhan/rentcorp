"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/form";
import { buildMessage, type MessageContext, type MessageType } from "@/lib/messages";
import { saveTemplate, type TemplateState } from "./actions";

const SAMPLE: MessageContext = {
  business: "Your Tent House",
  customer: "Sample Customer",
  bookingNumber: 42,
  startDate: "2026-10-12",
  startTime: "09:00",
  returnDate: "2026-10-14",
  plannedDays: 3,
  lines: [
    {
      name: "Plastic chair",
      unitLabel: "piece",
      quantity: 100,
      ratePaise: 1000,
      rateUnit: "PER_DAY",
      amountPaise: 300000,
    },
    {
      name: "Shamiana",
      unitLabel: "piece",
      quantity: 1,
      ratePaise: 150000,
      rateUnit: "PER_EVENT",
      amountPaise: 150000,
    },
  ],
  subtotalPaise: 450000,
  discountPaise: 45000,
  totalPaise: 405000,
  depositPaise: null,
  asOf: "2026-10-13",
  chargesSoFarPaise: 350000,
  discountSoFarPaise: 35000,
  paidPaise: 100000,
  amountDuePaise: 215000,
};

export function TemplateEditor({
  type,
  title,
  initialBody,
  isCustom,
}: {
  type: MessageType;
  title: string;
  initialBody: string;
  isCustom: boolean;
}) {
  const [state, formAction, pending] = useActionState<TemplateState, FormData>(saveTemplate, {});
  const [body, setBody] = useState(initialBody);
  // After "reset", show the server's default wording.
  const [lastSaved, setLastSaved] = useState<string | undefined>(undefined);
  if (state.body !== undefined && state.body !== lastSaved) {
    setLastSaved(state.body);
    setBody(state.body);
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
      data-testid={`template-${type}`}
    >
      <input type="hidden" name="type" value={type} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-stone-500">
          {isCustom ? "Your wording" : "Default wording"}
        </span>
      </div>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.saved && <FormMessage tone="success">{state.saved}</FormMessage>}
      <textarea
        name="body"
        aria-label={`${title} wording`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm focus:border-brand-600 focus:outline-none"
      />
      <details>
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          Preview with sample booking
        </summary>
        <pre
          className="mt-2 rounded-lg bg-stone-50 p-3 font-sans text-sm whitespace-pre-wrap"
          data-testid="template-preview"
        >
          {buildMessage(type, SAMPLE, body, "WHATSAPP")}
        </pre>
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="submit"
          name="reset"
          value="1"
          disabled={pending}
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 font-medium"
        >
          Reset to default
        </button>
      </div>
    </form>
  );
}
