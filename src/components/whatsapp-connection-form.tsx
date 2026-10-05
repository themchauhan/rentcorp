"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form";

type State = { error?: string; done?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

export type ConnectionView = {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  status: string;
};

const input =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";
const primary =
  "min-h-12 w-full rounded-lg bg-brand-700 px-5 font-semibold text-white disabled:opacity-60";

function Result({ state }: { state: State }) {
  if (state.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state.done) return <FormMessage tone="success">{state.done}</FormMessage>;
  return null;
}

export function WhatsAppConnectionForm({
  tenantId,
  connection,
  save,
  disconnect,
  test,
}: {
  /** Super admin only; owners' actions take the business from the session. */
  tenantId?: string;
  connection: ConnectionView | null;
  save: Action;
  disconnect: Action;
  test: Action;
}) {
  const [state, action, pending] = useActionState<State, FormData>(save, {});
  const [dState, dAction, dPending] = useActionState<State, FormData>(disconnect, {});
  const [tState, tAction, tPending] = useActionState<State, FormData>(test, {});
  const connected = connection?.status === "CONNECTED";
  return (
    <div className="space-y-5" data-testid="whatsapp-connection">
      <p
        className={`text-sm font-medium ${connected ? "text-green-700" : "text-stone-600"}`}
        data-testid="whatsapp-status"
      >
        {connected
          ? `Connected: ${connection!.display_phone_number}`
          : connection
            ? "Disconnected"
            : "Not connected"}
      </p>
      <form action={action} className="space-y-3">
        {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
        <Result state={state} />
        <div>
          <label htmlFor="wabaId" className={label}>
            WhatsApp Business Account ID
          </label>
          <input
            id="wabaId"
            name="wabaId"
            inputMode="numeric"
            defaultValue={connection?.waba_id}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="phoneNumberId" className={label}>
            Phone number ID
          </label>
          <input
            id="phoneNumberId"
            name="phoneNumberId"
            inputMode="numeric"
            defaultValue={connection?.phone_number_id}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="displayNumber" className={label}>
            WhatsApp number customers see
          </label>
          <input
            id="displayNumber"
            name="displayNumber"
            placeholder="+91 98765 43210"
            defaultValue={connection?.display_phone_number}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="accessToken" className={label}>
            Access token {connection ? "(leave blank to keep the saved one)" : ""}
          </label>
          <input
            id="accessToken"
            name="accessToken"
            type="password"
            autoComplete="off"
            className={input}
          />
          <p className="mt-1 text-xs text-stone-500">Stored encrypted. It is never shown again.</p>
        </div>
        <button type="submit" disabled={pending} className={primary}>
          {connection ? "Save connection" : "Connect WhatsApp"}
        </button>
      </form>

      {connected && (
        <form action={tAction} className="space-y-3">
          {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
          <Result state={tState} />
          <div>
            <label htmlFor="testNumber" className={label}>
              Send Meta’s test message to
            </label>
            <input
              id="testNumber"
              name="testNumber"
              type="tel"
              inputMode="numeric"
              className={input}
            />
          </div>
          <button
            type="submit"
            disabled={tPending}
            className="min-h-11 w-full rounded-lg border border-stone-300 bg-white font-medium disabled:opacity-60"
          >
            {tPending ? "Sending…" : "Send test message"}
          </button>
        </form>
      )}

      {connected && (
        <form action={dAction} className="space-y-2">
          {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
          <Result state={dState} />
          <button
            type="submit"
            disabled={dPending}
            className="min-h-11 w-full rounded-lg border border-red-300 bg-white text-sm font-medium text-red-700 disabled:opacity-60"
          >
            Disconnect WhatsApp
          </button>
        </form>
      )}
    </div>
  );
}
