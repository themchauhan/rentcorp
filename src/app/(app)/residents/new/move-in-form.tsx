"use client";

import { useActionState } from "react";
import { CustomerFields } from "@/components/customer-fields";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { emptyCustomerForm, type CustomerFormInput } from "@/lib/customers";
import { ID_TYPE_LABEL, ID_TYPES } from "@/lib/pg";
import { moveIn, type MoveInState } from "../actions";

export type PlaceOption = { value: string; label: string };

const select =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const labelCls = "block text-sm font-medium text-stone-700";

export function MoveInForm({
  places,
  plans,
  isOwner,
  initial,
}: {
  places: PlaceOption[];
  plans: PlaceOption[];
  isOwner: boolean;
  initial: {
    place: string;
    startDate: string;
    deposit: string;
    agreementMonths: string;
    lockInMonths: string;
  };
}) {
  const [state, action, pending] = useActionState<MoveInState, FormData>(moveIn, {});
  const v = state.values ?? {};
  const val = (k: string, fallback = "") => v[k] ?? fallback;
  const e = state.fieldErrors ?? {};
  const customer: CustomerFormInput = state.values
    ? {
        name: val("c_name"),
        mobile: val("c_mobile"),
        whatsappNumber: val("c_whatsappNumber"),
        notOnWhatsapp: v.c_notOnWhatsapp === "on",
        whatsappOptIn: false,
        preferredChannel: v.c_preferredChannel === "SMS" ? "SMS" : "WHATSAPP",
        address: val("c_address"),
      }
    : emptyCustomerForm;

  return (
    // Keyed on the returned values so inputs show them after a failed save.
    <form key={JSON.stringify(v)} action={action} className="space-y-5" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <div>
        <label htmlFor="place" className={labelCls}>
          Bed or room
        </label>
        <select
          id="place"
          name="place"
          defaultValue={val("place", initial.place)}
          className={select}
        >
          <option value="">Choose…</option>
          {places.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {e.place && <p className="mt-1 text-sm text-red-600">{e.place}</p>}
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <legend className="px-1 font-semibold">Resident</legend>
        <CustomerFields
          initial={customer}
          errors={state.customerErrors}
          prefix="c_"
          nameLabel="Resident name"
        />
        <Field
          label="Occupation or college (optional)"
          name="occupation"
          defaultValue={val("occupation")}
          error={e.occupation}
        />
        <div>
          <label htmlFor="idType" className={labelCls}>
            ID proof type (optional)
          </label>
          <select id="idType" name="idType" defaultValue={val("idType")} className={select}>
            <option value="">Not yet</option>
            {ID_TYPES.map((t) => (
              <option key={t} value={t}>
                {ID_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">
            Upload the ID photo from the resident’s page after saving.
          </p>
        </div>
        <Field
          label="Emergency contact name (optional)"
          name="emergencyName"
          defaultValue={val("emergencyName")}
          error={e.emergencyName}
        />
        <Field
          label="Emergency contact mobile (optional)"
          name="emergencyMobile"
          type="tel"
          inputMode="numeric"
          defaultValue={val("emergencyMobile")}
          error={e.emergencyMobile}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <legend className="px-1 font-semibold">Stay</legend>
        <Field
          label="Joining date (rent is due on this date every month)"
          name="startDate"
          type="date"
          defaultValue={val("startDate", initial.startDate)}
          error={e.startDate}
          required
        />
        <div>
          <label htmlFor="mealPlanId" className={labelCls}>
            Meal plan
          </label>
          <select
            id="mealPlanId"
            name="mealPlanId"
            defaultValue={val("mealPlanId")}
            className={select}
          >
            <option value="">No meals</option>
            {plans.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {e.mealPlanId && <p className="mt-1 text-sm text-red-600">{e.mealPlanId}</p>}
        </div>
        <Field
          label="Security deposit agreed (₹)"
          name="deposit"
          inputMode="decimal"
          defaultValue={val("deposit", initial.deposit)}
          error={e.deposit}
        />
        {isOwner && (
          <Field
            label="Different monthly rent (₹, optional — leave blank for the room’s rent)"
            name="rent"
            inputMode="decimal"
            defaultValue={val("rent")}
            error={e.rent}
          />
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <legend className="px-1 font-semibold">Agreement</legend>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Agreement (months)"
            name="agreementMonths"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            defaultValue={val("agreementMonths", initial.agreementMonths)}
            error={e.agreementMonths}
          />
          <Field
            label="Lock-in (months)"
            name="lockInMonths"
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            defaultValue={val("lockInMonths", initial.lockInMonths)}
            error={e.lockInMonths}
          />
        </div>
        <p className="text-xs text-stone-500">
          Starts on the joining date. Set months to 0 to skip; you can add it later and upload the
          signed copy on the resident’s page.
        </p>
      </fieldset>

      <SubmitButton pending={pending}>Save move-in</SubmitButton>
    </form>
  );
}
