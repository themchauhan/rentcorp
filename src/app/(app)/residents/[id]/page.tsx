import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { Collapsible as Section } from "@/components/collapsible";
import { SendPanel } from "@/components/send-panel";
import { Field, FormMessage } from "@/components/ui/form";
import { requireTenantMember } from "@/lib/auth/guards";
import { addDays, formatDate, todayIST } from "@/lib/dates";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import {
  ID_TYPE_LABEL,
  ID_TYPES,
  PAYMENT_PURPOSE_LABEL,
  placeLabel,
  STAY_STATUS_LABEL,
  type IdType,
} from "@/lib/pg";
import { dueDates, rateOn } from "@/lib/pg-dues";
import { buildPgMessage, PG_MESSAGE_TITLE, type PgMessageType } from "@/lib/pg-messages";
import { duesFor, loadPgTemplates, STAY_SELECT } from "@/lib/pg-server";
import { addMonths } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { saveResidentDetails } from "../actions";
import {
  addAdjustment,
  cancelStay,
  changeRates,
  giveNotice,
  removeIdPhoto,
  reversePgPayment,
  withdrawNotice,
} from "./actions";
import { PgPaymentForm, SettleForm } from "./forms";
import { IdPhotoUpload } from "./id-photo-upload";

export const metadata: Metadata = { title: "Resident" };

const card = "rounded-2xl border border-stone-200 bg-white p-4";
const select =
  "mt-1 block min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-base focus:border-brand-600 focus:outline-none";
const label = "block text-sm font-medium text-stone-700";
const CYCLE_TONE = {
  PAID: "bg-green-100 text-green-800",
  PART: "bg-amber-100 text-amber-800",
  DUE: "bg-red-100 text-red-800",
} as const;
const CYCLE_LABEL = { PAID: "Paid", PART: "Part paid", DUE: "Due" } as const;
const CHANNEL_LABEL = { WHATSAPP: "opened in WhatsApp", SMS: "opened in SMS", COPY: "copied" };

export default async function ResidentPage({ params, searchParams }: PageProps<"/residents/[id]">) {
  const profile = await requireTenantMember({ type: "HOSTEL_PG" });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const created = (await searchParams).created === "1";
  const supabase = await createClient();
  const { data: stay } = await supabase
    .from("pg_stays")
    .select(STAY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!stay || !stay.customer) notFound();

  const customer = stay.customer;
  const [
    { data: details },
    { data: docs },
    { data: log },
    { data: plans },
    { data: settings },
    templates,
    { data: staff },
  ] = await Promise.all([
    supabase
      .from("pg_resident_details")
      .select("emergency_name, emergency_mobile, occupation, id_type")
      .eq("customer_id", customer.id)
      .maybeSingle(),
    supabase
      .from("pg_id_documents")
      .select("id, doc_type, side, uploaded_at, removed_at")
      .eq("customer_id", customer.id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("message_log")
      .select("id, message_type, channel, opened_at")
      .eq("pg_stay_id", stay.id)
      .order("opened_at", { ascending: false })
      .limit(20),
    supabase
      .from("pg_meal_plans")
      .select("id, name, monthly_paise")
      .eq("active", true)
      .order("name"),
    supabase.from("pg_settings").select("notice_days").maybeSingle(),
    loadPgTemplates(supabase),
    supabase.from("profiles").select("id, name"),
  ]);

  const today = todayIST();
  const dues = duesFor(stay, today);
  const isOwner = profile.role === "ADMIN";
  const canWrite = !profile.readOnly;
  const ownerWrite = isOwner && canWrite;
  const live = stay.status === "ACTIVE" || stay.status === "NOTICE";
  const place = placeLabel(stay.room?.name ?? "?", stay.bed?.label ?? null);
  const current = rateOn(
    stay.rates.map((r) => ({
      effectiveFrom: r.effective_from,
      rentPaise: r.rent_paise,
      mealPaise: r.meal_paise,
      electricityPaise: r.electricity_paise,
      mealPlanName: r.meal_plan_name,
    })),
    today < stay.start_date ? stay.start_date : today,
  );
  const currentRow = [...stay.rates]
    .filter((r) => r.effective_from <= (today < stay.start_date ? stay.start_date : today))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
  const upcoming = [...stay.rates]
    .filter((r) => r.effective_from > today)
    .sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1));
  const staffName = new Map((staff ?? []).map((p) => [p.id, p.name]));
  const reversed = new Set(stay.payments.map((p) => p.reverses_payment_id).filter(Boolean));
  const payments = [...stay.payments].sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
  const lastPayment = payments.find((p) => p.kind === "PAYMENT" && p.purpose === "RENT");

  // Messages
  const ctx = {
    business: profile.tenant.name,
    resident: customer.name,
    place,
    asOf: today,
    dues,
    lastPayment: lastPayment
      ? { amountPaise: lastPayment.amount_paise, date: lastPayment.received_at.slice(0, 10) }
      : null,
  };
  const messageTypes: PgMessageType[] = [
    ...(dues.amountDue > 0 ? (["RENT_DUE"] as const) : []),
    ...(lastPayment ? (["PAYMENT_RECEIPT"] as const) : []),
  ];

  // Next due dates the owner can start new rates from.
  const futureDue = dueDates(stay.start_date, addMonths(today, 7))
    .filter((d) => d > today)
    .slice(0, 6);
  const noticeDays = settings?.notice_days ?? 30;
  const deposit = stay.deposit_paise;
  const depositToCollect = Math.max(0, deposit - dues.depositHeld);

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <BackLink href="/residents" label="Residents" />
        <h1 className="mt-2 text-2xl font-bold text-stone-900">{customer.name}</h1>
        <p className="text-stone-600">
          {place} · <span className="font-mono">{customer.mobile}</span>
        </p>
        <p className="mt-1 text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              stay.status === "ACTIVE"
                ? "bg-green-100 text-green-800"
                : stay.status === "NOTICE"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-200 text-stone-700"
            }`}
            data-testid="stay-status"
          >
            {STAY_STATUS_LABEL[stay.status]}
          </span>
          <span className="ml-2 text-stone-600">Joined {formatDate(stay.start_date)}</span>
        </p>
      </div>

      {created && <FormMessage tone="success">Moved in.</FormMessage>}

      <div className={card} data-testid="dues-summary">
        {stay.status === "MOVED_OUT" ? (
          <>
            <p className="text-sm text-stone-600">
              Moved out {stay.moved_out_on ? formatDate(stay.moved_out_on) : ""}
            </p>
            <p className="text-2xl font-bold" data-testid="settlement">
              {dues.final > 0
                ? `To collect: ${formatRupees(dues.final)}`
                : dues.final < 0
                  ? `Refund due: ${formatRupees(-dues.final)}`
                  : "Settled"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Rent balance {formatRupees(dues.balance)} − deposit held{" "}
              {formatRupees(dues.depositHeld)}
              {dues.refunds ? ` + refunded ${formatRupees(dues.refunds)}` : ""}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-600">Amount due today</p>
            <p
              className={`text-3xl font-bold ${dues.amountDue > 0 ? "text-red-700" : "text-green-700"}`}
              data-testid="amount-due"
            >
              {formatRupees(dues.amountDue)}
            </p>
            {dues.credit > 0 && (
              <p className="text-sm text-green-700">Credit {formatRupees(dues.credit)}</p>
            )}
            {dues.daysOverdue > 0 && (
              <p className="text-sm text-red-700">
                Oldest unpaid month is {dues.daysOverdue} days late
              </p>
            )}
            {dues.nextDueDate && (
              <p className="text-sm text-stone-600">Next due {formatDate(dues.nextDueDate)}</p>
            )}
          </>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {current && (
            <>
              <dt className="text-stone-600">Rent</dt>
              <dd>{formatRupees(current.rentPaise)}/month</dd>
              <dt className="text-stone-600">Meals</dt>
              <dd>
                {current.mealPlanName
                  ? `${current.mealPlanName} · ${formatRupees(current.mealPaise)}`
                  : "No meals"}
              </dd>
              <dt className="text-stone-600">Electricity</dt>
              <dd>{formatRupees(current.electricityPaise)}/month</dd>
              <dt className="font-medium text-stone-700">Monthly total</dt>
              <dd className="font-medium">
                {formatRupees(current.rentPaise + current.mealPaise + current.electricityPaise)}
              </dd>
            </>
          )}
          <dt className="text-stone-600">Deposit</dt>
          <dd data-testid="deposit">
            {formatRupees(dues.depositHeld)} held
            {deposit > dues.depositHeld ? ` of ${formatRupees(deposit)} agreed` : ""}
          </dd>
        </dl>
        {upcoming.map((r) => (
          <p key={r.effective_from} className="mt-2 text-sm text-stone-600">
            From {formatDate(r.effective_from)}: rent {formatRupees(r.rent_paise)}, meals{" "}
            {r.meal_plan_name ?? "none"}, electricity {formatRupees(r.electricity_paise)}
          </p>
        ))}
      </div>

      {canWrite &&
        messageTypes.map((type) => (
          <SendPanel
            key={type}
            stayId={stay.id}
            type={type}
            title={`${PG_MESSAGE_TITLE[type]} message`}
            whatsappText={buildPgMessage(type, ctx, templates[type], "WHATSAPP")}
            smsText={buildPgMessage(type, ctx, templates[type], "SMS")}
            mobile={customer.mobile}
            whatsappNumber={customer.whatsapp_number}
            preferredChannel={customer.preferred_channel}
          />
        ))}

      {canWrite && stay.status !== "CANCELLED" && (
        <Section
          // Reopens on a status change (e.g. moved out: a refund or balance to settle).
          key={stay.status}
          title="Record payment"
          initiallyOpen={dues.amountDue > 0 || (stay.status === "MOVED_OUT" && dues.final !== 0)}
          testId="section-payment"
        >
          <div className="mt-3">
            <PgPaymentForm
              // A new status (e.g. moved out) means new choices: start fresh.
              key={stay.status}
              stayId={stay.id}
              purposes={[
                "RENT",
                "DEPOSIT",
                ...(isOwner && stay.status === "MOVED_OUT" ? (["REFUND"] as const) : []),
              ]}
              initialPurpose={
                stay.status === "MOVED_OUT" && dues.final < 0 && isOwner ? "REFUND" : "RENT"
              }
              suggested={{
                RENT: stay.status === "MOVED_OUT" ? Math.max(0, dues.final) : dues.amountDue,
                DEPOSIT: depositToCollect,
                REFUND: Math.max(0, -dues.final),
              }}
            />
          </div>
        </Section>
      )}

      <div className={card} data-testid="months">
        <h2 className="mb-2 text-lg font-semibold">Months</h2>
        {dues.cycles.length === 0 ? (
          <p className="text-sm text-stone-600">
            Nothing due yet. First due date {formatDate(stay.start_date)}.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {[...dues.cycles].reverse().map((c) => (
              <li
                key={c.start}
                className="flex items-center justify-between gap-3 py-2"
                data-testid="month-row"
              >
                <span>
                  {formatDate(c.start)} – {formatDate(c.end)}
                  <span className="block text-xs text-stone-500">
                    Rent {formatRupees(c.rentPaise)}
                    {c.mealPaise ? ` + meals ${formatRupees(c.mealPaise)}` : ""}
                    {c.electricityPaise ? ` + electricity ${formatRupees(c.electricityPaise)}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  {formatRupees(c.total)}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${CYCLE_TONE[c.status]}`}
                  >
                    {CYCLE_LABEL[c.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {stay.adjustments.length > 0 && (
          <ul
            className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm"
            data-testid="adjustments"
          >
            {stay.adjustments.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  {a.kind === "CHARGE" ? "Extra charge" : "Discount"}: {a.reason}
                  <span className="block text-xs text-stone-500">{formatDate(a.on_date)}</span>
                </span>
                <span>
                  {a.kind === "CHARGE" ? "+" : "−"}
                  {formatRupees(a.amount_paise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card} data-testid="payments">
        <h2 className="mb-2 text-lg font-semibold">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-600">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="space-y-2 py-2">
                <div className="flex justify-between gap-3">
                  <span>
                    {p.kind === "REVERSAL" ? "Reversal" : PAYMENT_PURPOSE_LABEL[p.purpose]} ·{" "}
                    {p.mode}
                    <span className="block text-xs text-stone-500">
                      {formatDate(p.received_at.slice(0, 10))} by{" "}
                      {staffName.get(p.received_by ?? "") ?? "—"}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </span>
                  <span
                    className={p.kind === "REVERSAL" || reversed.has(p.id) ? "text-stone-400" : ""}
                  >
                    {formatRupees(Math.abs(p.amount_paise))}
                    {reversed.has(p.id) ? " (reversed)" : ""}
                  </span>
                </div>
                {ownerWrite && p.kind === "PAYMENT" && !reversed.has(p.id) && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-red-700">
                      Reverse
                    </summary>
                    <ActionForm
                      action={reversePgPayment}
                      hidden={{ paymentId: p.id }}
                      label="Reverse this payment"
                      tone="danger"
                      className="mt-2 space-y-2"
                    >
                      <Field label="Reason" name="reason" id={`reason-${p.id}`} />
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {ownerWrite && stay.status !== "CANCELLED" && (
        <Section title="Extra charge or discount" testId="section-adjustment">
          <ActionForm
            action={addAdjustment}
            hidden={{ stayId: stay.id }}
            label="Save"
            className="mt-3 space-y-3"
          >
            <div>
              <label htmlFor="adjKind" className={label}>
                Type
              </label>
              <select id="adjKind" name="kind" className={select} defaultValue="CHARGE">
                <option value="CHARGE">Extra charge (e.g. late fee, damage)</option>
                <option value="DISCOUNT">Discount</option>
              </select>
            </div>
            <Field label="Amount (₹)" name="amount" id="adjAmount" inputMode="decimal" />
            <Field label="Reason" name="reason" id="adjReason" />
          </ActionForm>
        </Section>
      )}

      {ownerWrite && live && currentRow && (
        <Section title="Change rent or meal plan" testId="section-rates">
          <ActionForm
            action={changeRates}
            hidden={{ stayId: stay.id }}
            label="Save new rates"
            className="mt-3 space-y-3"
          >
            <p className="text-sm text-stone-600">
              Applies from a future due date. Months already due don’t change.
            </p>
            <div>
              <label htmlFor="effectiveFrom" className={label}>
                Starting from
              </label>
              <select id="effectiveFrom" name="effectiveFrom" className={select}>
                {futureDue.map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Rent per month (₹)"
              name="rent"
              id="rateRent"
              inputMode="decimal"
              defaultValue={paiseToRupeesInput(currentRow.rent_paise)}
            />
            <div>
              <label htmlFor="rateMeal" className={label}>
                Meal plan
              </label>
              <select
                id="rateMeal"
                name="mealPlanId"
                className={select}
                defaultValue={currentRow.meal_plan_id ?? ""}
              >
                <option value="">No meals</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatRupees(p.monthly_paise)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Electricity per month (₹)"
              name="electricity"
              id="rateElec"
              inputMode="decimal"
              defaultValue={paiseToRupeesInput(currentRow.electricity_paise)}
            />
          </ActionForm>
        </Section>
      )}

      {canWrite && live && (
        <div className={card} data-testid="section-moveout">
          <h2 className="mb-3 text-lg font-semibold">Notice and move-out</h2>
          {stay.status === "ACTIVE" ? (
            <ActionForm
              action={giveNotice}
              hidden={{ stayId: stay.id }}
              label="Record notice"
              tone="secondary"
            >
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Notice given on"
                  name="noticeOn"
                  type="date"
                  defaultValue={today}
                  max={today}
                />
                <Field
                  label="Planned move-out"
                  name="plannedMoveOut"
                  type="date"
                  defaultValue={addDays(today, noticeDays)}
                  min={today}
                />
              </div>
              <p className="text-xs text-stone-500">Notice period: {noticeDays} days.</p>
            </ActionForm>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Notice given {stay.notice_given_on ? formatDate(stay.notice_given_on) : ""}; leaving{" "}
                <strong>{stay.planned_move_out ? formatDate(stay.planned_move_out) : ""}</strong>.
              </p>
              <ActionForm
                action={withdrawNotice}
                hidden={{ stayId: stay.id }}
                label="Withdraw notice (staying on)"
                tone="secondary"
              />
            </div>
          )}
          {isOwner && (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <h3 className="mb-2 font-semibold">Move-out settlement</h3>
              <p className="mb-3 text-sm text-stone-600">
                Deposit held {formatRupees(dues.depositHeld)} is set against what’s owed. Any
                deductions are added first.
              </p>
              <SettleForm
                stayId={stay.id}
                defaultDate={
                  stay.planned_move_out && stay.planned_move_out <= today
                    ? stay.planned_move_out
                    : today
                }
                minDate={stay.start_date}
                maxDate={today}
              />
            </div>
          )}
        </div>
      )}

      <div className={card} data-testid="resident-details">
        <h2 className="mb-2 text-lg font-semibold">Details</h2>
        <fieldset disabled={!canWrite}>
          <ActionForm
            action={saveResidentDetails}
            hidden={{ customerId: customer.id }}
            label="Save details"
            tone="secondary"
          >
            <Field
              label="Occupation or college"
              name="occupation"
              defaultValue={details?.occupation ?? ""}
            />
            <Field
              label="Emergency contact name"
              name="emergencyName"
              defaultValue={details?.emergency_name ?? ""}
            />
            <Field
              label="Emergency contact mobile"
              name="emergencyMobile"
              type="tel"
              inputMode="numeric"
              defaultValue={details?.emergency_mobile ?? ""}
            />
            <div>
              <label htmlFor="idTypeDetail" className={label}>
                ID proof type
              </label>
              <select
                id="idTypeDetail"
                name="idType"
                className={select}
                defaultValue={details?.id_type ?? ""}
              >
                <option value="">Not given</option>
                {ID_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ID_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </ActionForm>
        </fieldset>
      </div>

      <div className={card} data-testid="id-photos">
        <h2 className="mb-2 text-lg font-semibold">ID proof photos</h2>
        <ul className="mb-3 space-y-3">
          {(docs ?? []).map((d) => (
            <li key={d.id} className="space-y-2" data-testid="id-photo">
              <p className="text-sm">
                {ID_TYPE_LABEL[d.doc_type]} · {d.side.toLowerCase()} ·{" "}
                {formatDate(d.uploaded_at.slice(0, 10))}
                {d.removed_at && (
                  <span className="text-stone-500">
                    {" "}
                    · deleted {formatDate(d.removed_at.slice(0, 10))}
                  </span>
                )}
              </p>
              {!d.removed_at && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached image route */}
                  <img
                    src={`/api/id-photos/${d.id}`}
                    alt={`${ID_TYPE_LABEL[d.doc_type]} (${d.side.toLowerCase()})`}
                    className="max-h-64 rounded-lg border border-stone-200"
                    loading="lazy"
                  />
                  {isOwner && (
                    <ActionForm
                      action={removeIdPhoto}
                      hidden={{ docId: d.id }}
                      label="Delete this photo permanently"
                      tone="danger"
                      confirm="Delete this ID photo permanently? This can't be undone."
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {canWrite && (
          <IdPhotoUpload
            customerId={customer.id}
            defaultType={(details?.id_type as IdType | null) ?? null}
          />
        )}
      </div>

      {ownerWrite && live && stay.payments.length === 0 && (
        <ActionForm
          action={cancelStay}
          hidden={{ stayId: stay.id }}
          label="Cancel this move-in (entered by mistake)"
          tone="danger"
          confirm="Cancel this move-in? The bed becomes vacant."
        />
      )}

      <div className={card} data-testid="message-log">
        <h2 className="mb-2 text-lg font-semibold">Messages</h2>
        {log?.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {log.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span>
                  {PG_MESSAGE_TITLE[m.message_type as PgMessageType] ?? m.message_type} ·{" "}
                  {CHANNEL_LABEL[m.channel as keyof typeof CHANNEL_LABEL] ?? m.channel}
                </span>
                <span className="text-stone-500">
                  {new Date(m.opened_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">No messages yet.</p>
        )}
      </div>
    </section>
  );
}
