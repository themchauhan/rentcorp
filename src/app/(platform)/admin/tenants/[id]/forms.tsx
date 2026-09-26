"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/form";
import {
  extendSubscription,
  recordSubscriptionPayment,
  updateSubscription,
  type AdminActionState,
} from "./actions";

const input =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";
const primary =
  "min-h-12 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white disabled:opacity-60";

function Result({ state }: { state: AdminActionState }) {
  if (state.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state.done) return <FormMessage tone="success">{state.done}</FormMessage>;
  return null;
}

export function SubscriptionForm({
  tenantId,
  status,
  plan,
  trialEnds,
  subscriptionEnds,
}: {
  tenantId: string;
  status: string;
  plan: string;
  trialEnds: string;
  subscriptionEnds: string;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    updateSubscription,
    {},
  );
  const [planValue, setPlan] = useState(plan);
  return (
    <form action={action} className="space-y-4" data-testid="subscription-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Result state={state} />
      <div>
        <label htmlFor="status" className={label}>
          Status
        </label>
        <select id="status" name="status" defaultValue={status} className={input}>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>
      <div>
        <label htmlFor="plan" className={label}>
          Plan
        </label>
        <input
          id="plan"
          name="plan"
          value={planValue}
          onChange={(e) => setPlan(e.target.value)}
          className={input}
        />
        <div className="mt-2 flex gap-2">
          {["TRIAL", "MONTHLY", "YEARLY"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              className="min-h-10 rounded-full border border-stone-300 px-3 text-sm"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="trialEnds" className={label}>
            Trial ends
          </label>
          <input
            id="trialEnds"
            name="trialEnds"
            type="date"
            defaultValue={trialEnds}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="subscriptionEnds" className={label}>
            Subscription ends
          </label>
          <input
            id="subscriptionEnds"
            name="subscriptionEnds"
            type="date"
            defaultValue={subscriptionEnds}
            className={input}
          />
        </div>
      </div>
      <button type="submit" disabled={pending} className={primary}>
        Save
      </button>
    </form>
  );
}

export function ExtendButtons({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    extendSubscription,
    {},
  );
  return (
    <form action={action} className="space-y-3" data-testid="extend-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Result state={state} />
      <div className="grid grid-cols-3 gap-2">
        {[
          [1, "+1 month"],
          [3, "+3 months"],
          [12, "+1 year"],
        ].map(([m, text]) => (
          <button
            key={m}
            type="submit"
            name="months"
            value={m}
            disabled={pending}
            className="min-h-12 rounded-lg border border-brand-700 font-semibold text-brand-800 disabled:opacity-60"
          >
            {text}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500">Also sets the status to Active.</p>
    </form>
  );
}

export function SubscriptionPaymentForm({
  tenantId,
  today,
  periodStart,
  periodEnd,
}: {
  tenantId: string;
  today: string;
  periodStart: string;
  periodEnd: string;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    recordSubscriptionPayment,
    {},
  );
  return (
    <form action={action} className="space-y-4" data-testid="subscription-payment-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <Result state={state} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="subAmount" className={label}>
            Amount ₹
          </label>
          <input id="subAmount" name="amount" inputMode="decimal" className={input} />
        </div>
        <div>
          <label htmlFor="subMethod" className={label}>
            Method
          </label>
          <select id="subMethod" name="method" defaultValue="UPI" className={input}>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="paymentDate" className={label}>
            Paid on
          </label>
          <input
            id="paymentDate"
            name="paymentDate"
            type="date"
            defaultValue={today}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="reference" className={label}>
            Reference
          </label>
          <input id="reference" name="reference" placeholder="UPI / bank ref" className={input} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="periodStart" className={label}>
            Period from
          </label>
          <input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={periodStart}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="periodEnd" className={label}>
            Period to
          </label>
          <input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={periodEnd}
            className={input}
          />
        </div>
      </div>
      <div>
        <label htmlFor="subNotes" className={label}>
          Notes
        </label>
        <input id="subNotes" name="notes" className={input} />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" name="extend" defaultChecked className="h-5 w-5 accent-brand-700" />
        Extend the subscription to the period end and activate
      </label>
      <button type="submit" disabled={pending} className={primary}>
        Record payment
      </button>
    </form>
  );
}
