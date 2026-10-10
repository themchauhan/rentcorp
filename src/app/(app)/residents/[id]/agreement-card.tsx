import { ActionForm } from "@/components/action-form";
import { Collapsible as Section } from "@/components/collapsible";
import { Field } from "@/components/ui/form";
import { formatDate } from "@/lib/dates";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import {
  agreementEnd,
  agreementState,
  firstDueOnOrAfter,
  inLockIn,
  suggestedRent,
} from "@/lib/pg-agreements";
import { addDays } from "@/lib/dates";
import { createAgreement, renewAgreement, updateAgreement } from "./agreement-actions";
import { AgreementUpload } from "./agreement-upload";

export type AgreementRow = {
  id: string;
  start_date: string;
  end_date: string;
  lock_in_until: string | null;
  rent_increase_pct: number;
  status: "ACTIVE" | "RENEWED" | "ENDED";
  document_type: string | null;
  document_uploaded_at: string | null;
};

const card = "rounded-2xl border border-stone-200 bg-white p-4";
const BADGE = {
  expired: "bg-red-100 text-red-800",
  ending: "bg-amber-100 text-amber-800",
  ok: "bg-green-100 text-green-800",
} as const;

/** The resident's rent agreement: dates, lock-in, document, renew. */
export function AgreementCard({
  stayId,
  stayStart,
  live,
  agreement,
  history,
  today,
  alertDays,
  defaults,
  currentRentPaise,
  isOwner,
  canWrite,
}: {
  stayId: string;
  stayStart: string;
  live: boolean;
  agreement: AgreementRow | null;
  history: AgreementRow[];
  today: string;
  alertDays: number;
  defaults: { months: number; lockInMonths: number; increasePct: number };
  currentRentPaise: number | null;
  isOwner: boolean;
  canWrite: boolean;
}) {
  const ownerWrite = isOwner && canWrite;

  if (!agreement) {
    return (
      <div className={card} data-testid="agreement">
        <h2 className="mb-2 text-lg font-semibold">Agreement</h2>
        <p className="mb-3 text-sm text-stone-600">No rent agreement recorded.</p>
        {canWrite && live && (
          <ActionForm
            action={createAgreement}
            hidden={{ stayId }}
            label="Add agreement"
            tone="secondary"
            testId="agreement-create"
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts on" name="start" type="date" defaultValue={stayStart} />
              <Field
                label="Months"
                name="months"
                id="agreementMonths"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                defaultValue={defaults.months}
              />
              <Field
                label="Lock-in (months)"
                name="lockInMonths"
                type="number"
                inputMode="numeric"
                min={0}
                max={24}
                defaultValue={defaults.lockInMonths}
              />
              {isOwner && (
                <Field
                  label="Yearly increase %"
                  name="increasePct"
                  id="createIncreasePct"
                  inputMode="decimal"
                  defaultValue={defaults.increasePct}
                />
              )}
            </div>
          </ActionForm>
        )}
      </div>
    );
  }

  const state = agreementState(agreement.end_date, today, alertDays);
  const active = agreement.status === "ACTIVE";
  const renewStart = addDays(agreement.end_date, 1);
  const suggested =
    currentRentPaise !== null ? suggestedRent(currentRentPaise, agreement.rent_increase_pct) : null;
  const newRentFrom = firstDueOnOrAfter(stayStart, renewStart, today);

  return (
    <div className={card} data-testid="agreement">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Agreement</h2>
        {active && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[state.kind]}`}
            data-testid="agreement-state"
          >
            {state.kind === "expired"
              ? `Expired ${state.days} day${state.days === 1 ? "" : "s"} ago`
              : state.kind === "ending"
                ? state.days === 0
                  ? "Ends today"
                  : `Ends in ${state.days} day${state.days === 1 ? "" : "s"}`
                : "Current"}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-stone-600">From</dt>
        <dd data-testid="agreement-start">{formatDate(agreement.start_date)}</dd>
        <dt className="text-stone-600">Until</dt>
        <dd data-testid="agreement-end">{formatDate(agreement.end_date)}</dd>
        <dt className="text-stone-600">Lock-in</dt>
        <dd>
          {agreement.lock_in_until ? (
            <>
              until {formatDate(agreement.lock_in_until)}
              {inLockIn(agreement.lock_in_until, today) && (
                <span className="ml-1 text-amber-700">(now)</span>
              )}
            </>
          ) : (
            "None"
          )}
        </dd>
        <dt className="text-stone-600">Increase on renewal</dt>
        <dd>{Number(agreement.rent_increase_pct)}%</dd>
        <dt className="text-stone-600">Document</dt>
        <dd>
          {agreement.document_type ? (
            <a
              href={`/api/agreements/${agreement.id}/document`}
              target="_blank"
              rel="noopener"
              className="font-medium text-brand-700"
              data-testid="agreement-document"
            >
              View {agreement.document_type === "application/pdf" ? "PDF" : "photo"}
            </a>
          ) : (
            <span className="text-stone-500">Not uploaded</span>
          )}
        </dd>
      </dl>

      {ownerWrite && active && (
        <div className="mt-4 space-y-3">
          <AgreementUpload agreementId={agreement.id} hasDocument={!!agreement.document_type} />

          {live && (
            <Section
              title="Renew agreement"
              testId="agreement-renew"
              initiallyOpen={state.kind !== "ok"}
            >
              <ActionForm
                action={renewAgreement}
                hidden={{ agreementId: agreement.id, stayId }}
                label="Renew"
                className="space-y-3"
              >
                <p className="text-sm text-stone-600">
                  New term starts {formatDate(renewStart)}
                  {suggested !== null &&
                    ` · suggested rent ${formatRupees(suggested)} (+${Number(agreement.rent_increase_pct)}%)`}
                  . New rent applies from the due date {formatDate(newRentFrom)}.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Months"
                    name="months"
                    id="renewMonths"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    defaultValue={defaults.months}
                  />
                  <Field
                    label="New rent per month (₹)"
                    name="newRent"
                    id="renewRent"
                    inputMode="decimal"
                    defaultValue={suggested !== null ? paiseToRupeesInput(suggested) : ""}
                  />
                </div>
                <p className="text-xs text-stone-500">
                  Ends {formatDate(agreementEnd(renewStart, defaults.months))} for {defaults.months}{" "}
                  months. Clear the rent to keep it unchanged.
                </p>
              </ActionForm>
            </Section>
          )}

          <Section title="Edit dates" testId="agreement-edit">
            <ActionForm
              action={updateAgreement}
              hidden={{ agreementId: agreement.id, stayId }}
              label="Save"
              tone="secondary"
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Ends on"
                  name="end"
                  type="date"
                  defaultValue={agreement.end_date}
                  min={agreement.start_date}
                />
                <Field
                  label="Lock-in until"
                  name="lockInUntil"
                  type="date"
                  defaultValue={agreement.lock_in_until ?? ""}
                />
                <Field
                  label="Yearly increase %"
                  name="increasePct"
                  id="editIncreasePct"
                  inputMode="decimal"
                  defaultValue={Number(agreement.rent_increase_pct)}
                />
              </div>
            </ActionForm>
          </Section>
        </div>
      )}

      {history.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
          {history.map((h) => (
            <li key={h.id}>
              {h.status === "RENEWED" ? "Renewed" : "Ended"}: {formatDate(h.start_date)} –{" "}
              {formatDate(h.end_date)}
              {h.document_type && (
                <a
                  href={`/api/agreements/${h.id}/document`}
                  target="_blank"
                  rel="noopener"
                  className="ml-2 text-brand-700"
                >
                  document
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
