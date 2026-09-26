"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form";
import { setItemActive, type ItemStatusState } from "../actions";

export function StatusToggle({ itemId, active }: { itemId: string; active: boolean }) {
  const [state, formAction, pending] = useActionState<ItemStatusState, FormData>(setItemActive, {});
  return (
    <div className="space-y-3">
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.done && <FormMessage tone="success">{state.done}</FormMessage>}
      <form action={formAction}>
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-lg border border-stone-300 bg-white px-4 font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
        >
          {active ? "Deactivate item" : "Reactivate item"}
        </button>
      </form>
      <p className="text-sm text-stone-500">
        {active
          ? "Deactivated items can't be added to new bookings. Nothing is deleted."
          : "This item is hidden from new bookings. Reactivate it to use it again."}
      </p>
    </div>
  );
}
