// Which booking gets which message at 9 PM. Pure (unit-tested).
import { amountDueForStoredBooking } from "../bookings";
import type { OrderForMessages } from "../booking-messages";
import type { MessageType } from "../messages";

export type EveningOrder = OrderForMessages & { closed_at: string | null };

/**
 * Every customer with money due gets one message each evening until it's
 * settled: items still out (including overdue) → amount due; everything
 * back but unpaid → final bill. Nothing for cancelled, closed, not yet
 * started, fully paid, or customers who haven't agreed.
 */
export function eveningMessageFor(order: EveningOrder, asOf: string): MessageType | null {
  if (order.status === "CANCELLED" || order.closed_at) return null;
  if (order.event_start_date > asOf) return null;
  const c = order.customer;
  if (!c?.whatsapp_number || !c.whatsapp_opt_in) return null;
  const due = amountDueForStoredBooking(order, asOf);
  if (due.amountDue <= 0) return null;
  return order.status === "RETURNED" ? "RETURN_CONFIRMATION" : "AMOUNT_DUE";
}
