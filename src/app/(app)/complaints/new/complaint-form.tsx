"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY_LABEL } from "@/lib/pg";
import { raiseComplaint, type ComplaintState } from "../actions";

const select =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";

export function ComplaintForm({ options }: { options: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ComplaintState, FormData>(raiseComplaint, {});
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <div>
        <label htmlFor="category" className={label}>
          What is it about?
        </label>
        <select id="category" name="category" defaultValue={v.category ?? ""} className={select}>
          <option value="">Choose…</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {COMPLAINT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="where" className={label}>
          Resident or room (optional)
        </label>
        <select id="where" name="where" defaultValue={v.where ?? ""} className={select}>
          <option value="">Common area / not specific</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="description" className={label}>
          Problem
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={v.description}
          placeholder="e.g. Fan not working"
          className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none"
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input
          type="checkbox"
          name="urgent"
          defaultChecked={v.urgent === "on"}
          className="h-5 w-5 accent-brand-700"
        />
        Urgent
      </label>
      <SubmitButton pending={pending}>Save complaint</SubmitButton>
    </form>
  );
}
