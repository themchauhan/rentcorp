import { computeAmountDue, type AmountDue } from "./amount-due";
import type { RateUnit } from "./items";
import { estimateBooking, type DiscountType } from "./pricing";

export type SnapshotLine = {
  id?: string;
  quantity: number;
  rate_paise_snapshot: number;
  rate_unit_snapshot: RateUnit;
};

export type StoredReturn = {
  rental_order_item_id: string;
  quantity_returned: number;
  returned_on: string;
};

type StoredBooking = {
  status: "ACTIVE" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE" | "CANCELLED";
  returns?: StoredReturn[];
  payments?: { amount_paise: number }[];
  event_start_date: string;
  expected_return_date: string;
  discount_type: DiscountType;
  discount_value: number;
  lines: SnapshotLine[];
};

/** Planned-dates estimate from a stored booking's snapshotted lines. */
export function estimateStoredBooking(order: Omit<StoredBooking, "status">) {
  return estimateBooking(
    order.lines.map((l) => ({
      ratePaise: l.rate_paise_snapshot,
      rateUnit: l.rate_unit_snapshot,
      quantity: l.quantity,
    })),
    order.event_start_date,
    order.expected_return_date,
    { type: order.discount_type, value: order.discount_value },
  );
}

/** Amount due for a stored booking (with its returns and payments) as of an IST date. */
export function amountDueForStoredBooking(order: StoredBooking, asOf: string): AmountDue {
  return computeAmountDue(
    {
      startDate: order.event_start_date,
      cancelled: order.status === "CANCELLED",
      discount: { type: order.discount_type, value: order.discount_value },
      lines: order.lines.map((l, i) => ({
        id: l.id ?? String(i),
        quantity: l.quantity,
        ratePaise: l.rate_paise_snapshot,
        rateUnit: l.rate_unit_snapshot,
        returns: (order.returns ?? [])
          .filter((r) => r.rental_order_item_id === l.id)
          .map((r) => ({ quantity: r.quantity_returned, returnedOn: r.returned_on })),
      })),
      payments: (order.payments ?? []).map((p) => ({ amountPaise: p.amount_paise })),
    },
    asOf,
  );
}
