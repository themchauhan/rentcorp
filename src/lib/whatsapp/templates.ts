// Meta-approved message templates used for automatic sends. The SAME names
// and texts must be submitted for approval on every business's WhatsApp
// account (see docs/whatsapp/templates.md). Parameters are positional.
import { formatDate, formatTime } from "../dates";
import { formatRupees } from "../money";
import type { MessageContext, MessageType } from "../messages";

export const TEMPLATE_LANGUAGE = "en";

type TemplateDef = { name: string; text: string; params: (ctx: MessageContext) => string[] };

function itemsSummary(ctx: MessageContext): string {
  const parts = ctx.lines.map((l) => `${l.quantity} ${l.name}`);
  return parts.length > 5
    ? `${parts.slice(0, 5).join(", ")} +${parts.length - 5} more`
    : parts.join(", ");
}

export const API_TEMPLATES: Record<MessageType, TemplateDef> = {
  BOOKING_CONFIRMATION: {
    name: "rentcorp_booking_details",
    text:
      "Hello {{1}}, thank you for booking with {{2}}. Booking #{{3}}: {{4}}. " +
      "From {{5}} to {{6}}. Total: {{7}}. Reply to this message if anything needs changing.",
    params: (ctx) => [
      ctx.customer,
      ctx.business,
      String(ctx.bookingNumber),
      itemsSummary(ctx),
      formatDate(ctx.startDate) + (ctx.startTime ? `, ${formatTime(ctx.startTime)}` : ""),
      formatDate(ctx.returnDate),
      formatRupees(ctx.totalPaise),
    ],
  },
  AMOUNT_DUE: {
    name: "rentcorp_amount_due",
    text:
      "Hello {{1}}, this is {{2}}. For booking #{{3}}, the amount due as of {{4}} is {{5}}. " +
      "Please contact us if you have already paid.",
    params: (ctx) => [
      ctx.customer,
      ctx.business,
      String(ctx.bookingNumber),
      formatDate(ctx.asOf),
      formatRupees(ctx.amountDuePaise),
    ],
  },
  RETURN_CONFIRMATION: {
    name: "rentcorp_final_bill",
    text:
      "Hello {{1}}, thank you — all items for booking #{{3}} with {{2}} are back. " +
      "Final bill {{4}}, paid {{5}}, balance {{6}}.",
    params: (ctx) => [
      ctx.customer,
      ctx.business,
      String(ctx.bookingNumber),
      formatRupees(ctx.chargesSoFarPaise - ctx.discountSoFarPaise),
      formatRupees(ctx.paidPaise),
      formatRupees(ctx.amountDuePaise),
    ],
  },
};

/** The exact text the customer receives, for the message log. */
export function renderTemplate(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (m, n: string) => params[Number(n) - 1] ?? m);
}
