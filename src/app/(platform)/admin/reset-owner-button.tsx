"use client";

import { useActionState } from "react";
import { TempPasswordNotice } from "@/components/temp-password-notice";
import { FormMessage } from "@/components/ui/form";
import { resetOwnerPassword, type OwnerActionState } from "./actions";

export function ResetOwnerButton({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState<OwnerActionState, FormData>(
    resetOwnerPassword,
    {},
  );
  return (
    <div className="space-y-2">
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.issued && <TempPasswordNotice {...state.issued} />}
      <form action={formAction}>
        <input type="hidden" name="profileId" value={profileId} />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
        >
          Reset owner password
        </button>
      </form>
    </div>
  );
}
