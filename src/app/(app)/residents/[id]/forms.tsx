"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/form";
import { paiseToRupeesInput } from "@/lib/money";
import { recordPgPayment, settleMoveOut, type ActionState } from "./actions";

const label = "block text-sm font-medium text-stone-700";
const input =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const primary =
  "min-h-12 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white disabled:opacity-60";
const seg = (on: boolean) =>
  `min-h-11 rounded-lg border px-2 text-sm ${
    on
      ? "border-brand-700 bg-brand-50 font-semibold text-brand-800"
      : "border-stone-300 bg-white text-stone-700"
  }`;

function Result({ state }: { state: ActionState }) {
  if (state.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state.done) return <FormMessage tone="success">{state.done}</FormMessage>;
  return null;
}

const MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["CARD", "Card"],
  ["OTHER", "Other"],
] as const;

type Purpose = "RENT" | "DEPOSIT" | "REFUND";

export function PgPaymentForm({
  stayId,
  suggested,
  purposes,
  initialPurpose = "RENT",
}: {
  stayId: string;
  /** Pre-filled amount for each purpose (paise). */
  suggested: Partial<Record<Purpose, number>>;
  purposes: Purpose[];
  initialPurpose?: Purpose;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordPgPayment, {});
  const [mode, setMode] = useState<string>("CASH");
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose);
  const amount = suggested[purpose] ?? 0;
  const text = { RENT: "Rent", DEPOSIT: "Deposit", REFUND: "Refund paid" } as const;
  return (
    <form action={action} className="space-y-4" data-testid="pg-payment-form">
      <input type="hidden" name="stayId" value={stayId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="purpose" value={purpose} />
      <Result state={state} />
      {purposes.length > 1 && (
        <fieldset>
          <legend className={label}>For</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {purposes.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={purpose === p}
                className={seg(purpose === p)}
                onClick={() => setPurpose(p)}
              >
                {text[p]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor="pgAmount" className={label}>
          {purpose === "REFUND" ? "Amount refunded ₹" : "Amount received ₹"}
        </label>
        <input
          id="pgAmount"
          name="amount"
          inputMode="decimal"
          key={`${purpose}-${amount}`}
          defaultValue={amount > 0 ? paiseToRupeesInput(amount) : ""}
          className={input}
        />
      </div>
      <fieldset>
        <legend className={label}>{purpose === "REFUND" ? "Paid back by" : "Paid by"}</legend>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {MODES.map(([m, t]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={seg(mode === m)}
              onClick={() => setMode(m)}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="pgNote" className={label}>
          Note (optional)
        </label>
        <input id="pgNote" name="note" placeholder="e.g. UPI ref 1234" className={input} />
      </div>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : purpose === "REFUND" ? "Record refund" : "Record payment"}
      </button>
    </form>
  );
}

export function SettleForm({
  stayId,
  defaultDate,
  minDate,
  maxDate,
}: {
  stayId: string;
  defaultDate: string;
  minDate: string;
  maxDate: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(settleMoveOut, {});
  const [rows, setRows] = useState(0);
  return (
    <form
      action={action}
      className="space-y-4"
      data-testid="settle-form"
      onSubmit={(e) => {
        if (!window.confirm("Record the move-out? The bed becomes vacant.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="stayId" value={stayId} />
      <Result state={state} />
      <div>
        <label htmlFor="movedOutOn" className={label}>
          Move-out date
        </label>
        <input
          id="movedOutOn"
          name="movedOutOn"
          type="date"
          defaultValue={defaultDate}
          min={minDate}
          max={maxDate}
          className={input}
        />
        <p className="mt-1 text-xs text-stone-500">
          Months starting on or after this date aren’t charged.
        </p>
      </div>
      {Array.from({ length: rows }, (_, i) => i + 1).map((i) => (
        <div key={i} className="grid grid-cols-[7rem_1fr] gap-2">
          <div>
            <label htmlFor={`deductionAmount${i}`} className={label}>
              Deduction ₹
            </label>
            <input
              id={`deductionAmount${i}`}
              name={`deductionAmount${i}`}
              inputMode="decimal"
              className={input}
            />
          </div>
          <div>
            <label htmlFor={`deductionReason${i}`} className={label}>
              Reason
            </label>
            <input
              id={`deductionReason${i}`}
              name={`deductionReason${i}`}
              placeholder="e.g. Broken chair"
              className={input}
            />
          </div>
        </div>
      ))}
      {rows < 3 && (
        <button
          type="button"
          onClick={() => setRows(rows + 1)}
          className="text-sm font-medium text-brand-700"
        >
          + Add a deduction from the deposit
        </button>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Record move-out"}
      </button>
    </form>
  );
}
