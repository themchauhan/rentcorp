"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/form";
import { paiseToRupeesInput } from "@/lib/money";
import {
  cancelBooking,
  closeBooking,
  recordPayment,
  recordReturn,
  reversePayment,
  updateDiscount,
  type ActionState,
} from "./actions";

const input =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";
const primary =
  "min-h-12 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white disabled:opacity-60";
const seg = (on: boolean) =>
  `flex min-h-11 flex-1 items-center justify-center rounded-lg border text-sm font-medium ${
    on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-300 bg-white text-stone-700"
  }`;

function Result({ state }: { state: ActionState }) {
  if (state.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state.done) return <FormMessage tone="success">{state.done}</FormMessage>;
  return null;
}

export type ReturnLine = { id: string; name: string; unit: string; out: number };

export function ReturnForm({
  orderId,
  lines,
  minDate,
  today,
}: {
  orderId: string;
  lines: ReturnLine[];
  minDate: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordReturn, {});
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (id: string, n: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, Math.trunc(n) || 0)) }));

  return (
    <form action={action} className="space-y-4" data-testid="return-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(lines.map((l) => ({ lineId: l.id, quantity: qty[l.id] ?? 0 })))}
      />
      <Result state={state} />
      <button
        type="button"
        className="min-h-11 w-full rounded-lg border border-stone-300 bg-white font-medium"
        onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, l.out])))}
      >
        Everything is back
      </button>
      <ul className="divide-y divide-stone-100">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{l.name}</p>
              <p className="text-xs text-stone-500">
                {l.out} {l.unit} still out
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                aria-label={`Returned ${l.name}`}
                inputMode="numeric"
                placeholder="0"
                value={qty[l.id] ? String(qty[l.id]) : ""}
                onChange={(e) => set(l.id, Number(e.target.value.replace(/\D/g, "")), l.out)}
                className="h-11 w-20 rounded-lg border border-stone-300 text-center text-base"
              />
              <button
                type="button"
                onClick={() => set(l.id, l.out, l.out)}
                className="h-11 rounded-lg border border-stone-300 px-3 text-sm"
              >
                All
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="returnedOn" className={label}>
            Returned on
          </label>
          <input
            id="returnedOn"
            name="returnedOn"
            type="date"
            defaultValue={today}
            min={minDate}
            max={today}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="returnNotes" className={label}>
            Condition notes
          </label>
          <input id="returnNotes" name="notes" placeholder="Optional" className={input} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Record return"}
      </button>
    </form>
  );
}

const MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["CARD", "Card"],
  ["OTHER", "Other"],
] as const;

export function PaymentForm({
  orderId,
  suggestedPaise,
}: {
  orderId: string;
  suggestedPaise: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordPayment, {});
  const [mode, setMode] = useState<string>("CASH");
  return (
    <form action={action} className="space-y-4" data-testid="payment-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="mode" value={mode} />
      <Result state={state} />
      <div>
        <label htmlFor="amount" className={label}>
          Amount received ₹
        </label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={suggestedPaise > 0 ? paiseToRupeesInput(suggestedPaise) : ""}
          key={suggestedPaise}
          className={input}
        />
      </div>
      <fieldset>
        <legend className={label}>Paid by</legend>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {MODES.map(([m, text]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={seg(mode === m)}
              onClick={() => setMode(m)}
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="paymentNote" className={label}>
          Note (optional)
        </label>
        <input id="paymentNote" name="note" placeholder="e.g. UPI ref 1234" className={input} />
      </div>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}

export function DiscountForm({
  orderId,
  initialType,
  initialValue,
  initialReason,
}: {
  orderId: string;
  initialType: "NONE" | "FLAT" | "PERCENT";
  initialValue: string;
  initialReason: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateDiscount, {});
  const [type, setType] = useState(initialType);
  return (
    <form action={action} className="space-y-3" data-testid="discount-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="discountType" value={type} />
      <Result state={state} />
      <div className="flex gap-2">
        {(
          [
            ["NONE", "None"],
            ["FLAT", "₹ off"],
            ["PERCENT", "% off"],
          ] as const
        ).map(([t, text]) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            className={seg(type === t)}
            onClick={() => setType(t)}
          >
            {text}
          </button>
        ))}
      </div>
      {type !== "NONE" && (
        <>
          <input
            name="discountValue"
            aria-label={type === "FLAT" ? "Discount amount in rupees" : "Discount percentage"}
            inputMode="decimal"
            defaultValue={type === initialType ? initialValue : ""}
            placeholder={type === "FLAT" ? "e.g. 500" : "e.g. 10"}
            className={input}
          />
          <input
            name="discountReason"
            aria-label="Discount reason"
            defaultValue={initialReason}
            placeholder="Reason (optional)"
            className={input}
          />
        </>
      )}
      <button type="submit" disabled={pending} className={primary}>
        Save discount
      </button>
    </form>
  );
}

export function CloseForm({ orderId, credit }: { orderId: string; credit: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(closeBooking, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Result state={state} />
      {credit && (
        <p className="text-sm text-amber-800">
          The customer has {credit} credit. Refund it (reverse a payment) before closing if you owe
          it back.
        </p>
      )}
      <button type="submit" disabled={pending} className={primary}>
        Close booking
      </button>
    </form>
  );
}

export function CancelForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelBooking, {});
  return (
    <form action={action} className="space-y-3" data-testid="cancel-form">
      <input type="hidden" name="orderId" value={orderId} />
      <Result state={state} />
      <input
        name="reason"
        aria-label="Reason for cancelling"
        placeholder="Reason for cancelling"
        className={input}
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg border border-red-300 bg-white font-semibold text-red-700 disabled:opacity-60"
      >
        Cancel booking
      </button>
    </form>
  );
}

export function ReverseForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reversePayment, {});
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Result state={state} />
      <input
        name="reason"
        aria-label="Reason for reversal"
        placeholder="Reason (e.g. refund, entered twice)"
        className={input}
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg border border-stone-300 bg-white text-sm font-medium"
      >
        Reverse this payment
      </button>
    </form>
  );
}
