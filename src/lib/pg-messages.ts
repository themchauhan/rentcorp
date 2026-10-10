// Resident messages (hostel / PG). Pure, like src/lib/messages.ts: figures
// come from the dues engine, the business's wording fills the text, and
// staff send it from their own phone with one tap.
import { formatDate } from "./dates";
import { fillTemplate, SMS_MAX_LENGTH, type MessageChannel } from "./messages";
import { formatRupees } from "./money";
import type { StayDues } from "./pg-dues";

export type PgMessageType = "RENT_DUE" | "PAYMENT_RECEIPT" | "AGREEMENT_RENEWAL";
export const PG_MESSAGE_TYPES: PgMessageType[] = [
  "RENT_DUE",
  "PAYMENT_RECEIPT",
  "AGREEMENT_RENEWAL",
];

export const PG_MESSAGE_TITLE: Record<PgMessageType, string> = {
  RENT_DUE: "Rent due",
  PAYMENT_RECEIPT: "Payment receipt",
  AGREEMENT_RENEWAL: "Agreement renewal",
};

export type PgMessageContext = {
  business: string;
  resident: string;
  place: string;
  asOf: string;
  dues: Pick<StayDues, "amountDue" | "credit" | "nextDueDate" | "cycles" | "depositHeld">;
  lastPayment: { amountPaise: number; date: string } | null;
  /** Current agreement and the proposed rent for the next term (renewal message). */
  agreement?: { endDate: string; newRentPaise: number | null } | null;
};

export const PG_DEFAULT_TEMPLATES: Record<PgMessageType, string> = {
  RENT_DUE: `{business}
Hi {resident}, rent reminder for {place}.
Amount due as of {today}: {amount_due}
{unpaid_months}

Please pay at the earliest. Thank you!`,
  PAYMENT_RECEIPT: `{business}
Received {last_payment} from {resident} on {payment_date} for {place}.
Balance now: {amount_due}
Next due date: {next_due}
Thank you!`,
  AGREEMENT_RENEWAL: `{business}
Hi {resident}, your rent agreement for {place} ends on {agreement_end}.
{new_rent_line}
Please let us know if you'd like to renew. Thank you!`,
};

const COMPACT_SMS: Record<PgMessageType, string> = {
  RENT_DUE: `{business}: {resident}, rent due as of {today}: {amount_due} for {place}.`,
  PAYMENT_RECEIPT: `{business}: Received {last_payment} from {resident}. Balance {amount_due}.`,
  AGREEMENT_RENEWAL: `{business}: {resident}, your agreement for {place} ends {agreement_end}. Reply to renew.`,
};

export const PG_PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "business", meaning: "Your business name" },
  { key: "resident", meaning: "Resident name" },
  { key: "place", meaning: "Room and bed" },
  { key: "today", meaning: "Today's date" },
  { key: "amount_due", meaning: "Amount due now" },
  { key: "unpaid_months", meaning: "Months not fully paid, with amounts" },
  { key: "next_due", meaning: "Next due date" },
  { key: "last_payment", meaning: "Amount of the latest payment" },
  { key: "payment_date", meaning: "Date of the latest payment" },
  { key: "deposit", meaning: "Deposit held" },
  { key: "agreement_end", meaning: "Agreement end date" },
  { key: "new_rent_line", meaning: "“New rent from renewal: ₹X/month” (only if set)" },
];

function money(paise: number, channel: MessageChannel): string {
  const s = formatRupees(paise);
  return channel === "SMS" ? s.replace("₹", "Rs.") : s;
}

function values(ctx: PgMessageContext, channel: MessageChannel): Record<string, string> {
  const unpaid = ctx.dues.cycles
    .filter((c) => c.status !== "PAID")
    .map(
      (c) =>
        `- ${formatDate(c.start)} to ${formatDate(c.end)}: ${money(c.total - c.paid, channel)}` +
        (c.paid > 0 ? ` (part paid)` : ""),
    )
    .join("\n");
  return {
    business: ctx.business,
    resident: ctx.resident,
    place: ctx.place,
    today: formatDate(ctx.asOf),
    amount_due: money(ctx.dues.amountDue, channel),
    unpaid_months: unpaid,
    next_due: ctx.dues.nextDueDate ? formatDate(ctx.dues.nextDueDate) : "-",
    last_payment: ctx.lastPayment ? money(ctx.lastPayment.amountPaise, channel) : "-",
    payment_date: ctx.lastPayment ? formatDate(ctx.lastPayment.date) : "-",
    agreement_end: ctx.agreement ? formatDate(ctx.agreement.endDate) : "-",
    new_rent_line:
      ctx.agreement?.newRentPaise != null
        ? `New rent from renewal: ${money(ctx.agreement.newRentPaise, channel)}/month`
        : "",
    deposit: money(ctx.dues.depositHeld, channel),
  };
}

export function buildPgMessage(
  type: PgMessageType,
  ctx: PgMessageContext,
  template: string,
  channel: MessageChannel,
): string {
  const vals = values(ctx, channel);
  const full = fillTemplate(template, vals);
  if (channel === "SMS" && full.length > SMS_MAX_LENGTH)
    return fillTemplate(COMPACT_SMS[type], vals);
  return full;
}

/** A sample for the wording editor's preview. */
export const PG_SAMPLE: PgMessageContext = {
  business: "Your PG",
  resident: "Demo Resident",
  place: "Room 101 · Bed A",
  asOf: "2026-10-12",
  dues: {
    amountDue: 1250000,
    credit: 0,
    depositHeld: 1000000,
    nextDueDate: "2026-11-12",
    cycles: [
      {
        index: 0,
        start: "2026-09-12",
        end: "2026-10-11",
        rentPaise: 600000,
        mealPaise: 250000,
        electricityPaise: 50000,
        mealPlanName: "Breakfast + Dinner",
        total: 900000,
        paid: 550000,
        status: "PART",
      },
      {
        index: 1,
        start: "2026-10-12",
        end: "2026-11-11",
        rentPaise: 600000,
        mealPaise: 250000,
        electricityPaise: 50000,
        mealPlanName: "Breakfast + Dinner",
        total: 900000,
        paid: 0,
        status: "DUE",
      },
    ],
  },
  lastPayment: { amountPaise: 550000, date: "2026-09-20" },
  agreement: { endDate: "2026-11-11", newRentPaise: 630000 },
};
