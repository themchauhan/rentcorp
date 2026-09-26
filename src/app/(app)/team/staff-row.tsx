"use client";

import { useActionState } from "react";
import { TempPasswordNotice } from "@/components/temp-password-notice";
import { FormMessage } from "@/components/ui/form";
import { resetStaffPassword, setStaffActive, type StaffActionState } from "./actions";

type Staff = { id: string; name: string; mobile: string; status: "ACTIVE" | "INACTIVE" };

const buttonClass =
  "min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60";

export function StaffRow({ staff }: { staff: Staff }) {
  const [resetState, resetAction, resetting] = useActionState<StaffActionState, FormData>(
    resetStaffPassword,
    {},
  );
  const [activeState, activeAction, toggling] = useActionState<StaffActionState, FormData>(
    setStaffActive,
    {},
  );
  const active = staff.status === "ACTIVE";
  const error = resetState.error ?? activeState.error;

  return (
    <li
      className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
      data-testid="staff-row"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{staff.name}</p>
          <p className="font-mono text-sm text-stone-600">{staff.mobile}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-600"
          }`}
        >
          {active ? "Active" : "Deactivated"}
        </span>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {resetState.issued && <TempPasswordNotice {...resetState.issued} />}

      <div className="flex flex-wrap gap-2">
        <form action={resetAction}>
          <input type="hidden" name="profileId" value={staff.id} />
          <button type="submit" className={buttonClass} disabled={resetting}>
            Reset password
          </button>
        </form>
        <form action={activeAction}>
          <input type="hidden" name="profileId" value={staff.id} />
          <input type="hidden" name="active" value={active ? "false" : "true"} />
          <button type="submit" className={buttonClass} disabled={toggling}>
            {active ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </div>
    </li>
  );
}
