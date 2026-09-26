"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { CustomerFields } from "@/components/customer-fields";
import { FormMessage } from "@/components/ui/form";
import { emptyCustomerForm } from "@/lib/customers";
import { RATE_UNIT_LABEL, type RateUnit } from "@/lib/items";
import { formatRupees, parseRupeesToPaise } from "@/lib/money";
import { estimateBooking, parsePercentToBasisPoints, type DiscountType } from "@/lib/pricing";
import { createBooking, type BookingFormState } from "../actions";

export type PickItem = {
  id: string;
  name: string;
  category: string;
  unitLabel: string;
  ratePaise: number;
  rateUnit: RateUnit;
  owned: number;
};
export type PickCustomer = { id: string; name: string; mobile: string };

const inputClass =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const labelClass = "block text-sm font-medium text-stone-700";
const sectionClass = "space-y-4 rounded-2xl border border-stone-200 bg-white p-4";
const segClass = (on: boolean) =>
  `flex min-h-11 flex-1 items-center justify-center rounded-lg border text-sm font-medium ${
    on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-300 bg-white text-stone-700"
  }`;

function ErrorText({ children }: { children?: string }) {
  return children ? <p className="mt-1 text-sm text-red-600">{children}</p> : null;
}

export function BookingForm({
  items,
  customers,
  today,
  initialCustomerId,
}: {
  items: PickItem[];
  customers: PickCustomer[];
  today: string;
  initialCustomerId?: string;
}) {
  const [state, formAction] = useActionState<BookingFormState, FormData>(createBooking, {});
  const [pending, startTransition] = useTransition();

  // Customer
  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [knownCustomers, setKnownCustomers] = useState(customers);
  // Dates
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [returnDate, setReturnDate] = useState(today);
  // Items
  const [qty, setQty] = useState<Record<string, number>>({});
  const [itemQuery, setItemQuery] = useState("");
  const [category, setCategory] = useState("");
  // Extras
  const [deposit, setDeposit] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [notes, setNotes] = useState("");

  // If a new customer got saved but the booking didn't, switch to it.
  if (state.createdCustomerId && customerId !== state.createdCustomerId && mode === "new") {
    setMode("existing");
    setCustomerId(state.createdCustomerId);
  }

  const selectedCustomer = knownCustomers.find((c) => c.id === customerId);
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return knownCustomers.slice(0, 6);
    return knownCustomers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.mobile.includes(q.replace(/\D/g, "") || "\u0000"),
      )
      .slice(0, 8);
  }, [customerQuery, knownCustomers]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const visibleItems = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!itemQuery.trim() || i.name.toLowerCase().includes(itemQuery.trim().toLowerCase())),
  );
  const chosen = items.filter((i) => (qty[i.id] ?? 0) > 0);

  const discount = useMemo(() => {
    const v =
      discountType === "FLAT"
        ? parseRupeesToPaise(discountValue)
        : discountType === "PERCENT"
          ? parsePercentToBasisPoints(discountValue)
          : 0;
    return { type: v ? discountType : ("NONE" as DiscountType), value: v ?? 0 };
  }, [discountType, discountValue]);

  const datesValid = startDate && returnDate && returnDate >= startDate;
  const estimate = estimateBooking(
    chosen.map((i) => ({ ratePaise: i.ratePaise, rateUnit: i.rateUnit, quantity: qty[i.id] })),
    startDate || today,
    datesValid ? returnDate : startDate || today,
    discount,
  );

  const setItemQty = (id: string, value: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(1_000_000, Math.trunc(value) || 0)) }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit manually so React doesn't reset the form between warnings.
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-28" noValidate>
      <input type="hidden" name="customerMode" value={mode} />
      <input type="hidden" name="customerId" value={mode === "existing" ? customerId : ""} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(chosen.map((i) => ({ itemId: i.id, quantity: qty[i.id] })))}
      />

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      {/* ---------------------------------------------------------------- Customer */}
      <section className={sectionClass} aria-labelledby="customer-heading">
        <h2 id="customer-heading" className="text-lg font-semibold">
          Customer
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={segClass(mode === "existing")}
            onClick={() => setMode("existing")}
          >
            Existing customer
          </button>
          <button type="button" className={segClass(mode === "new")} onClick={() => setMode("new")}>
            New customer
          </button>
        </div>

        {mode === "existing" ? (
          selectedCustomer ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
              <div>
                <p className="font-semibold" data-testid="selected-customer">
                  {selectedCustomer.name}
                </p>
                <p className="font-mono text-sm text-stone-600">{selectedCustomer.mobile}</p>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-brand-700"
                onClick={() => setCustomerId("")}
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="customerSearch" className={labelClass}>
                Find customer
              </label>
              <input
                id="customerSearch"
                type="search"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Name or mobile"
                className={inputClass}
                autoComplete="off"
              />
              <ul className="mt-2 divide-y divide-stone-100">
                {customerMatches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCustomerId(c.id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-1 text-left"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-sm text-stone-500">{c.mobile}</span>
                    </button>
                  </li>
                ))}
                {customerMatches.length === 0 && (
                  <li className="py-2 text-sm text-stone-500">No match. Use “New customer”.</li>
                )}
              </ul>
              <ErrorText>{fe.customer}</ErrorText>
            </div>
          )
        ) : (
          <>
            <CustomerFields initial={emptyCustomerForm} errors={state.customerErrors} prefix="c_" />
            {state.duplicate && (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
              >
                <p>
                  A customer with this mobile already exists:{" "}
                  <strong>{state.duplicate.name}</strong> ({state.duplicate.mobile}).
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-amber-400 bg-white px-4 font-medium"
                    onClick={() => {
                      const d = state.duplicate!;
                      setKnownCustomers((list) =>
                        list.some((c) => c.id === d.id) ? list : [d, ...list],
                      );
                      setMode("existing");
                      setCustomerId(d.id);
                    }}
                  >
                    Use {state.duplicate.name}
                  </button>
                  <button
                    type="submit"
                    name="confirmDuplicate"
                    value="1"
                    className="min-h-11 rounded-lg bg-amber-700 px-4 font-medium text-white"
                  >
                    Create new anyway
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------------------------------------------------------------- Dates */}
      <section className={sectionClass} aria-labelledby="dates-heading">
        <h2 id="dates-heading" className="text-lg font-semibold">
          Dates
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="startDate" className={labelClass}>
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (returnDate < e.target.value) setReturnDate(e.target.value);
              }}
              className={inputClass}
            />
            <ErrorText>{fe.startDate}</ErrorText>
          </div>
          <div>
            <label htmlFor="startTime" className={labelClass}>
              Start time (optional)
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
            <ErrorText>{fe.startTime}</ErrorText>
          </div>
        </div>
        <div>
          <label htmlFor="returnDate" className={labelClass}>
            Return date
          </label>
          <input
            id="returnDate"
            name="returnDate"
            type="date"
            min={startDate}
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className={inputClass}
          />
          <ErrorText>{fe.returnDate}</ErrorText>
          {datesValid && (
            <p className="mt-1 text-sm text-stone-600" data-testid="day-count">
              {estimate.days} day{estimate.days === 1 ? "" : "s"} (first and last day both count)
            </p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Items */}
      <section className={sectionClass} aria-labelledby="items-heading">
        <h2 id="items-heading" className="text-lg font-semibold">
          Items {chosen.length > 0 && <span className="text-stone-500">({chosen.length})</span>}
        </h2>
        <input
          type="search"
          value={itemQuery}
          onChange={(e) => setItemQuery(e.target.value)}
          placeholder="Search items"
          aria-label="Search items"
          className={inputClass}
        />
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          role="group"
          aria-label="Item categories"
        >
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
                category === c
                  ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
                  : "border-stone-300 bg-white"
              }`}
            >
              {c || "All"}
            </button>
          ))}
        </div>
        <ErrorText>{fe.lines}</ErrorText>
        <ul className="divide-y divide-stone-100">
          {visibleItems.map((i) => {
            const n = qty[i.id] ?? 0;
            return (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 py-2"
                data-testid="pick-item"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-stone-500">
                    {formatRupees(i.ratePaise)} / {i.unitLabel} {RATE_UNIT_LABEL[i.rateUnit]} ·{" "}
                    {i.owned} owned
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Fewer ${i.name}`}
                    onClick={() => setItemQty(i.id, n - 1)}
                    disabled={n === 0}
                    className="h-11 w-11 rounded-lg border border-stone-300 text-xl disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    aria-label={`Quantity of ${i.name}`}
                    inputMode="numeric"
                    value={n === 0 ? "" : String(n)}
                    placeholder="0"
                    onChange={(e) => setItemQty(i.id, Number(e.target.value.replace(/\D/g, "")))}
                    className="h-11 w-16 rounded-lg border border-stone-300 text-center text-base"
                  />
                  <button
                    type="button"
                    aria-label={`More ${i.name}`}
                    onClick={() => setItemQty(i.id, n + 1)}
                    className="h-11 w-11 rounded-lg border border-stone-300 text-xl"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
          {visibleItems.length === 0 && (
            <li className="py-2 text-sm text-stone-500">No items match.</li>
          )}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- Extras */}
      <section className={sectionClass} aria-labelledby="extras-heading">
        <h2 id="extras-heading" className="text-lg font-semibold">
          Deposit, discount and notes
        </h2>
        <div>
          <label htmlFor="deposit" className={labelClass}>
            Security deposit ₹ (optional)
          </label>
          <input
            id="deposit"
            name="deposit"
            inputMode="decimal"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className={inputClass}
          />
          <ErrorText>{fe.deposit}</ErrorText>
        </div>
        <fieldset>
          <legend className={labelClass}>Discount</legend>
          <input type="hidden" name="discountType" value={discountType} />
          <div className="mt-1 flex gap-2">
            {(
              [
                ["NONE", "None"],
                ["FLAT", "₹ off"],
                ["PERCENT", "% off"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                aria-pressed={discountType === t}
                className={segClass(discountType === t)}
                onClick={() => setDiscountType(t)}
              >
                {label}
              </button>
            ))}
          </div>
          {discountType !== "NONE" && (
            <div className="mt-3 space-y-3">
              <input
                name="discountValue"
                aria-label={
                  discountType === "FLAT" ? "Discount amount in rupees" : "Discount percentage"
                }
                inputMode="decimal"
                placeholder={discountType === "FLAT" ? "e.g. 500" : "e.g. 10"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className={inputClass}
              />
              <input
                name="discountReason"
                aria-label="Discount reason"
                placeholder="Reason (optional)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <ErrorText>{fe.discount ?? fe.discountReason}</ErrorText>
        </fieldset>
        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none"
          />
          <ErrorText>{fe.notes}</ErrorText>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Summary */}
      <section
        className={sectionClass}
        aria-labelledby="summary-heading"
        data-testid="booking-summary"
      >
        <h2 id="summary-heading" className="text-lg font-semibold">
          Summary
        </h2>
        {chosen.length === 0 ? (
          <p className="text-sm text-stone-500">No items added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {chosen.map((i, idx) => (
                <tr key={i.id} className="align-top">
                  <td className="py-1 pr-2">
                    {i.name}
                    <span className="block text-xs text-stone-500">
                      {qty[i.id]} × {formatRupees(i.ratePaise)}
                      {i.rateUnit === "PER_DAY"
                        ? ` × ${estimate.days} day${estimate.days === 1 ? "" : "s"}`
                        : " (per event)"}
                    </span>
                  </td>
                  <td className="py-1 text-right font-medium">
                    {formatRupees(estimate.lineAmounts[idx])}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-200">
                <td className="pt-2">Subtotal</td>
                <td className="pt-2 text-right">{formatRupees(estimate.gross)}</td>
              </tr>
              {estimate.discount > 0 && (
                <tr>
                  <td>Discount</td>
                  <td className="text-right">−{formatRupees(estimate.discount)}</td>
                </tr>
              )}
              <tr className="text-base font-bold">
                <td className="pt-1">Estimated total</td>
                <td className="pt-1 text-right" data-testid="estimated-total">
                  {formatRupees(estimate.total)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="text-xs text-stone-500">
          For the planned dates. The final bill depends on when items actually come back.
        </p>
      </section>

      {state.stockWarnings && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <p className="font-semibold">Not enough stock on these dates</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {state.stockWarnings.map((w) => (
              <li key={w.itemId}>
                {w.name}: {w.requested} wanted, only {w.free} of {w.owned} free
                {w.committed > 0 ? ` (${w.committed} in other bookings)` : ""}
              </li>
            ))}
          </ul>
          <button
            type="submit"
            name="confirmStock"
            value="1"
            disabled={pending}
            className="min-h-11 rounded-lg bg-amber-700 px-4 font-medium text-white"
          >
            Save anyway
          </button>
        </div>
      )}

      {/* Sticky total + save, above the phone tab bar. */}
      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg md:bottom-4">
        <div>
          <p className="text-xs text-stone-500">Estimated total</p>
          <p className="text-lg font-bold">{formatRupees(estimate.total)}</p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-lg bg-brand-700 px-6 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save booking"}
        </button>
      </div>
    </form>
  );
}
