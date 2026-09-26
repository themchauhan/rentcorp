import { estimateBooking, type DiscountType } from "./pricing";
import type { RateUnit } from "./items";

export type SnapshotLine = {
  quantity: number;
  rate_paise_snapshot: number;
  rate_unit_snapshot: RateUnit;
};

/** Planned-dates estimate from a stored booking's snapshotted lines. */
export function estimateStoredBooking(order: {
  event_start_date: string;
  expected_return_date: string;
  discount_type: DiscountType;
  discount_value: number;
  lines: SnapshotLine[];
}) {
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
