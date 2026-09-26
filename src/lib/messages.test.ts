import { describe, expect, it } from "vitest";
import { detectPlatform, smsLink, whatsappLink } from "./message-links";
import {
  buildMessage,
  DEFAULT_TEMPLATES,
  fillTemplate,
  SMS_MAX_LENGTH,
  type MessageContext,
  type MessageLine,
} from "./messages";

const lines: MessageLine[] = [
  {
    name: "Plastic chair",
    unitLabel: "piece",
    quantity: 100,
    ratePaise: 1000,
    rateUnit: "PER_DAY",
    amountPaise: 300000,
  },
  {
    name: "Shamiana 20x20 ft",
    unitLabel: "piece",
    quantity: 1,
    ratePaise: 150000,
    rateUnit: "PER_EVENT",
    amountPaise: 150000,
  },
];

const ctx: MessageContext = {
  business: "Demo Tent House A",
  customer: "Ravi",
  bookingNumber: 12,
  startDate: "2026-10-12",
  startTime: "09:30",
  returnDate: "2026-10-14",
  plannedDays: 3,
  lines,
  subtotalPaise: 450000,
  discountPaise: 45000,
  totalPaise: 405000,
  depositPaise: 200000,
  asOf: "2026-10-13",
  chargesSoFarPaise: 350000,
  discountSoFarPaise: 35000,
  paidPaise: 100000,
  amountDuePaise: 215000,
};

describe("booking confirmation", () => {
  it("lists items with rates and amounts, totals and dates", () => {
    const text = buildMessage(
      "BOOKING_CONFIRMATION",
      ctx,
      DEFAULT_TEMPLATES.BOOKING_CONFIRMATION,
      "WHATSAPP",
    );
    expect(text).toBe(`Demo Tent House A
Booking #12 for Ravi
12 Oct 2026, 9:30 am to 14 Oct 2026 (3 days)

- Plastic chair: 100 x ₹10/piece per day x 3 days = ₹3,000
- Shamiana 20x20 ft: 1 x ₹1,500/piece per event = ₹1,500

Subtotal: ₹4,500
Discount: -₹450
Total: ₹4,050
Security deposit: ₹2,000

Thank you!`);
  });

  it("drops the discount and deposit lines when there are none", () => {
    const text = buildMessage(
      "BOOKING_CONFIRMATION",
      { ...ctx, discountPaise: 0, totalPaise: 450000, depositPaise: null },
      DEFAULT_TEMPLATES.BOOKING_CONFIRMATION,
      "WHATSAPP",
    );
    expect(text).not.toMatch(/Discount|deposit/);
    expect(text).toContain("Subtotal: ₹4,500\n\nTotal: ₹4,500\n\nThank you!");
  });

  it("uses Rs. instead of ₹ for SMS", () => {
    const text = buildMessage(
      "BOOKING_CONFIRMATION",
      ctx,
      DEFAULT_TEMPLATES.BOOKING_CONFIRMATION,
      "SMS",
    );
    expect(text).not.toContain("₹");
    expect(text).toContain("Total: Rs.4,050");
  });

  it("switches SMS to the compact form when the item list is long", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...lines[0],
      name: `Item number ${i + 1}`,
    }));
    const text = buildMessage(
      "BOOKING_CONFIRMATION",
      { ...ctx, lines: many },
      DEFAULT_TEMPLATES.BOOKING_CONFIRMATION,
      "SMS",
    );
    expect(text.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
    expect(text).toBe(
      "Demo Tent House A: Booking #12, 12 items, 12 Oct 2026, 9:30 am to 14 Oct 2026. Total Rs.4,050.",
    );
    // WhatsApp keeps the full list.
    const wa = buildMessage(
      "BOOKING_CONFIRMATION",
      { ...ctx, lines: many },
      DEFAULT_TEMPLATES.BOOKING_CONFIRMATION,
      "WHATSAPP",
    );
    expect(wa).toContain("Item number 12");
  });
});

describe("amount due", () => {
  it("states the amount due as of the date", () => {
    expect(buildMessage("AMOUNT_DUE", ctx, DEFAULT_TEMPLATES.AMOUNT_DUE, "WHATSAPP"))
      .toBe(`Demo Tent House A
Booking #12 for Ravi
Amount due as of 13 Oct 2026: ₹2,150
Charges so far ₹3,500 less ₹350 discount, paid ₹1,000.`);
  });
});

describe("templates", () => {
  it("fills custom wording and leaves unknown placeholders alone", () => {
    expect(fillTemplate("Hi {customer}, {nope}!", { customer: "Ravi" })).toBe("Hi Ravi, {nope}!");
  });
});

describe("links", () => {
  const text = "Total: ₹4,050 & thanks?";

  it("builds a wa.me link with country code and encoded text", () => {
    expect(whatsappLink("9876543210", text)).toBe(
      "https://wa.me/919876543210?text=Total%3A%20%E2%82%B94%2C050%20%26%20thanks%3F",
    );
  });

  it("uses ?body= on Android and &body= on iOS", () => {
    expect(smsLink("9876543210", "Hi", "android")).toBe("sms:+919876543210?body=Hi");
    expect(smsLink("9876543210", "Hi", "ios")).toBe("sms:+919876543210&body=Hi");
  });

  it("rejects numbers that aren't normalised", () => {
    expect(() => whatsappLink("+91 98765 43210", "x")).toThrow();
  });

  it("detects iPhone, iPad (as Mac with touch) and Android", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 7)")).toBe("android");
  });
});
