// Customer message builder. Pure: turns booking figures + a wording
// template into plain text. The app never sends anything itself; this
// text is opened in WhatsApp / the SMS app on the user's phone.
import { formatDate, formatTime } from "./dates";
import { RATE_UNIT_LABEL, type RateUnit } from "./items";
import { formatRupees } from "./money";

export type MessageType = "BOOKING_CONFIRMATION" | "AMOUNT_DUE" | "RETURN_CONFIRMATION";
export type MessageChannel = "WHATSAPP" | "SMS";

export type MessageLine = {
  name: string;
  unitLabel: string;
  quantity: number;
  ratePaise: number;
  rateUnit: RateUnit;
  amountPaise: number;
};

export type MessageContext = {
  business: string;
  customer: string;
  bookingNumber: number;
  startDate: string;
  startTime: string | null;
  returnDate: string;
  plannedDays: number;
  lines: MessageLine[];
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  depositPaise: number | null;
  // Amount-due figures (as of `asOf`).
  asOf: string;
  chargesSoFarPaise: number;
  discountSoFarPaise: number;
  paidPaise: number;
  amountDuePaise: number;
};

export const DEFAULT_TEMPLATES: Record<MessageType, string> = {
  BOOKING_CONFIRMATION: `{business}
Booking #{booking_no} for {customer}
{start} to {return} ({days})

{items}

Subtotal: {subtotal}
{discount_line}
Total: {total}
{deposit_line}

Thank you!`,
  AMOUNT_DUE: `{business}
Booking #{booking_no} for {customer}
Amount due as of {today}: {amount_due}
Charges so far {charges}{discount_part}, paid {paid}.`,
  RETURN_CONFIRMATION: `{business}
Booking #{booking_no}: all items returned. Thank you!
Final bill {charges}{discount_part}, paid {paid}.
Balance: {amount_due}`,
};

// Short, ₹-free versions used for SMS when the full text is long.
const COMPACT_SMS: Record<MessageType, string> = {
  BOOKING_CONFIRMATION: `{business}: Booking #{booking_no}, {item_count}, {start} to {return}. Total {total}.`,
  AMOUNT_DUE: `{business}: Booking #{booking_no} amount due as of {today}: {amount_due}.`,
  RETURN_CONFIRMATION: `{business}: Booking #{booking_no} returned. Balance {amount_due}. Thank you!`,
};

export const PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "business", meaning: "Your business name" },
  { key: "customer", meaning: "Customer name" },
  { key: "booking_no", meaning: "Booking number" },
  { key: "start", meaning: "Start date (and time)" },
  { key: "return", meaning: "Return date" },
  { key: "days", meaning: "Planned days, e.g. 3 days" },
  { key: "items", meaning: "Item list with rates and amounts" },
  { key: "item_count", meaning: "e.g. 2 items" },
  { key: "subtotal", meaning: "Planned subtotal" },
  { key: "discount_line", meaning: "Discount line (only if there is one)" },
  { key: "total", meaning: "Planned total" },
  { key: "deposit_line", meaning: "Security deposit line (only if set)" },
  { key: "today", meaning: "Today's date" },
  { key: "charges", meaning: "Charges so far" },
  { key: "discount_part", meaning: "“ less ₹X discount” (only if there is one)" },
  { key: "paid", meaning: "Amount paid so far" },
  { key: "amount_due", meaning: "Amount due now" },
];

/** SMS: plain "Rs." keeps messages in the GSM alphabet (₹ makes each SMS only 70 chars). */
function money(paise: number, channel: MessageChannel): string {
  const s = formatRupees(paise);
  return channel === "SMS" ? s.replace("₹", "Rs.") : s;
}

function itemLine(l: MessageLine, days: number, channel: MessageChannel): string {
  const rate = `${money(l.ratePaise, channel)}/${l.unitLabel} ${RATE_UNIT_LABEL[l.rateUnit]}`;
  const period = l.rateUnit === "PER_DAY" ? ` x ${days} day${days === 1 ? "" : "s"}` : "";
  return `- ${l.name}: ${l.quantity} x ${rate}${period} = ${money(l.amountPaise, channel)}`;
}

function values(ctx: MessageContext, channel: MessageChannel): Record<string, string> {
  const days = `${ctx.plannedDays} day${ctx.plannedDays === 1 ? "" : "s"}`;
  return {
    business: ctx.business,
    customer: ctx.customer,
    booking_no: String(ctx.bookingNumber),
    start: formatDate(ctx.startDate) + (ctx.startTime ? `, ${formatTime(ctx.startTime)}` : ""),
    return: formatDate(ctx.returnDate),
    days,
    items: ctx.lines.map((l) => itemLine(l, ctx.plannedDays, channel)).join("\n"),
    item_count: `${ctx.lines.length} item${ctx.lines.length === 1 ? "" : "s"}`,
    subtotal: money(ctx.subtotalPaise, channel),
    discount_line: ctx.discountPaise > 0 ? `Discount: -${money(ctx.discountPaise, channel)}` : "",
    total: money(ctx.totalPaise, channel),
    deposit_line:
      ctx.depositPaise !== null ? `Security deposit: ${money(ctx.depositPaise, channel)}` : "",
    today: formatDate(ctx.asOf),
    charges: money(ctx.chargesSoFarPaise, channel),
    discount_part:
      ctx.discountSoFarPaise > 0 ? ` less ${money(ctx.discountSoFarPaise, channel)} discount` : "",
    paid: money(ctx.paidPaise, channel),
    amount_due: money(ctx.amountDuePaise, channel),
  };
}

/** Replaces {placeholders}; unknown ones are left as typed. Tidies blank lines. */
export function fillTemplate(template: string, vals: Record<string, string>): string {
  const filled = template.replace(/\{([a-z_]+)\}/g, (m, key: string) => vals[key] ?? m);
  return filled
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ~3 SMS segments of GSM text. Longer itemized SMS switch to the compact form.
export const SMS_MAX_LENGTH = 459;

export function buildMessage(
  type: MessageType,
  ctx: MessageContext,
  template: string,
  channel: MessageChannel,
): string {
  const vals = values(ctx, channel);
  const full = fillTemplate(template, vals);
  if (channel === "SMS" && full.length > SMS_MAX_LENGTH) {
    return fillTemplate(COMPACT_SMS[type], vals);
  }
  return full;
}
