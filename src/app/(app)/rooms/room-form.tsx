"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { RENT_MODE_LABEL, type RentMode, type RoomFormInput } from "@/lib/pg";
import type { RoomFormState } from "./actions";

type Props = {
  action: (prev: RoomFormState, fd: FormData) => Promise<RoomFormState>;
  initial: RoomFormInput & { underMaintenance?: boolean };
  roomId?: string;
  submitLabel: string;
};

export function RoomForm({ action, initial, roomId, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<RoomFormState, FormData>(action, {});
  const v = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const [mode, setMode] = useState<RentMode>((initial.rentMode as RentMode) || "PER_BED");

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {roomId && <input type="hidden" name="roomId" value={roomId} />}
      <input type="hidden" name="rentMode" value={mode} />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.done && <FormMessage tone="success">{state.done}</FormMessage>}
      <Field
        label="Room name or number"
        name="name"
        defaultValue={v.name}
        error={errors.name}
        placeholder="e.g. 101"
        required
      />
      <Field
        label="Floor (optional)"
        name="floor"
        defaultValue={v.floor}
        error={errors.floor}
        placeholder="e.g. Ground, First"
      />
      <div>
        <p className="block text-sm font-medium text-stone-700">How is rent charged?</p>
        <div role="group" aria-label="Rent type" className="mt-1 grid grid-cols-2 gap-2">
          {(["PER_BED", "PER_ROOM"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-12 rounded-lg border px-3 text-base ${
                mode === m
                  ? "border-brand-700 bg-brand-50 font-semibold text-brand-800"
                  : "border-stone-300 bg-white text-stone-700"
              }`}
            >
              {RENT_MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {errors.rentMode && <p className="mt-1 text-sm text-red-600">{errors.rentMode}</p>}
      </div>
      <Field
        label={
          mode === "PER_BED"
            ? "Rent per bed, per month (₹)"
            : "Rent for the whole room, per month (₹)"
        }
        name="rent"
        inputMode="decimal"
        defaultValue={v.rent}
        error={errors.rent}
        required
      />
      {!roomId && (
        <Field
          label="Beds in this room"
          name="beds"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          defaultValue={v.beds}
          error={errors.beds}
          required
        />
      )}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={v.notes}
          placeholder="e.g. AC, attached bathroom"
          className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none"
        />
        {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes}</p>}
      </div>
      {roomId && (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="underMaintenance"
            defaultChecked={initial.underMaintenance}
            className="h-5 w-5 accent-brand-700"
          />
          Under maintenance (no new residents)
        </label>
      )}
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  );
}
