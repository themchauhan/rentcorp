import { describe, expect, it } from "vitest";
import { eveningMessageFor, type EveningOrder } from "./evening";

const base: EveningOrder = {
  booking_number: 1,
  status: "ACTIVE",
  event_start_date: "2026-10-01",
  event_start_time: null,
  expected_return_date: "2026-10-03",
  security_deposit_paise: null,
  discount_type: "NONE",
  discount_value: 0,
  closed_at: null,
  customer: {
    name: "Ravi",
    mobile: "9111111101",
    whatsapp_number: "9111111101",
    preferred_channel: "WHATSAPP",
    whatsapp_opt_in: true,
  },
  lines: [
    {
      id: "l1",
      quantity: 10,
      item_name_snapshot: "Chair",
      unit_label_snapshot: "piece",
      rate_paise_snapshot: 1000,
      rate_unit_snapshot: "PER_DAY",
    },
  ],
  returns: [],
  payments: [],
};
const on = "2026-10-02";

describe("eveningMessageFor", () => {
  it("sends the amount due while items are out", () => {
    expect(eveningMessageFor(base, on)).toBe("AMOUNT_DUE");
  });
  it("keeps sending for overdue bookings", () => {
    expect(
      eveningMessageFor(
        { ...base, status: "OVERDUE", expected_return_date: "2026-10-01" },
        "2026-10-05",
      ),
    ).toBe("AMOUNT_DUE");
  });
  it("sends the final bill when everything is back but unpaid", () => {
    const returned: EveningOrder = {
      ...base,
      status: "RETURNED",
      returns: [{ rental_order_item_id: "l1", quantity_returned: 10, returned_on: "2026-10-02" }],
    };
    expect(eveningMessageFor(returned, on)).toBe("RETURN_CONFIRMATION");
  });
  it("sends nothing once fully paid", () => {
    expect(eveningMessageFor({ ...base, payments: [{ amount_paise: 20000 }] }, on)).toBeNull();
  });
  it("sends nothing for cancelled, closed, not started, or without consent/WhatsApp", () => {
    expect(eveningMessageFor({ ...base, status: "CANCELLED" }, on)).toBeNull();
    expect(eveningMessageFor({ ...base, closed_at: "2026-10-02T10:00:00Z" }, on)).toBeNull();
    expect(eveningMessageFor({ ...base, event_start_date: "2026-10-05" }, on)).toBeNull();
    expect(
      eveningMessageFor({ ...base, customer: { ...base.customer!, whatsapp_opt_in: false } }, on),
    ).toBeNull();
    expect(
      eveningMessageFor({ ...base, customer: { ...base.customer!, whatsapp_number: null } }, on),
    ).toBeNull();
  });
});
