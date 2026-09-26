"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { RATE_UNIT_LABEL, UNIT_SUGGESTIONS, type ItemFormInput, type RateUnit } from "@/lib/items";
import type { ItemFormState } from "./actions";

type Props = {
  action: (prev: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  initial: ItemFormInput;
  categories: string[];
  itemId?: string;
  submitLabel: string;
};

function Chips({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.toLowerCase() === value.trim().toLowerCase();
        return (
          <button
            key={o}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(o)}
            className={`min-h-10 rounded-full border px-3 text-sm ${
              selected
                ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function ItemForm({ action, initial, categories, itemId, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(action, {});
  const v = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  // Controlled so the chips can fill them.
  const [category, setCategory] = useState(initial.category);
  const [unitLabel, setUnitLabel] = useState(initial.unitLabel);
  const [rateUnit, setRateUnit] = useState<RateUnit>(initial.rateUnit || "PER_DAY");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {itemId && <input type="hidden" name="itemId" value={itemId} />}

      <Field
        label="Item name"
        name="name"
        defaultValue={v.name}
        placeholder="e.g. Plastic chair"
        error={errors.name}
        autoComplete="off"
        required
      />

      <div>
        <Field
          label="Category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Pick below or type your own"
          error={errors.category}
          autoComplete="off"
          required
        />
        <Chips
          label="Category suggestions"
          options={categories}
          value={category}
          onPick={setCategory}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Quantity owned"
          name="quantity"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={v.quantity}
          error={errors.quantity}
          required
        />
        <Field
          label="Unit"
          name="unitLabel"
          value={unitLabel}
          onChange={(e) => setUnitLabel(e.target.value)}
          error={errors.unitLabel}
          autoComplete="off"
          required
        />
      </div>
      <Chips
        label="Unit suggestions"
        options={UNIT_SUGGESTIONS}
        value={unitLabel}
        onPick={setUnitLabel}
      />

      <Field
        label="Price (₹)"
        name="price"
        type="text"
        inputMode="decimal"
        defaultValue={v.price}
        placeholder="e.g. 150"
        error={errors.price}
        required
      />

      <fieldset>
        <legend className="block text-sm font-medium text-stone-700">Charged</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(Object.keys(RATE_UNIT_LABEL) as RateUnit[]).map((u) => (
            <label
              key={u}
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border text-base font-medium ${
                rateUnit === u
                  ? "border-brand-700 bg-brand-50 text-brand-800"
                  : "border-stone-300 bg-white text-stone-700"
              }`}
            >
              <input
                type="radio"
                name="rateUnit"
                value={u}
                checked={rateUnit === u}
                onChange={() => setRateUnit(u)}
                className="sr-only"
              />
              {RATE_UNIT_LABEL[u]}
            </label>
          ))}
        </div>
        {errors.rateUnit && <p className="mt-1 text-sm text-red-600">{errors.rateUnit}</p>}
      </fieldset>

      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
