import { describe, expect, it } from "vitest";
import { emptyCustomerForm, parseCustomer } from "./customers";

const base = { ...emptyCustomerForm, name: " Ravi ", mobile: "98765 43210" };

describe("parseCustomer", () => {
  it("defaults the WhatsApp number to the mobile", () => {
    expect(parseCustomer(base)).toEqual({
      ok: true,
      row: {
        name: "Ravi",
        mobile: "9876543210",
        whatsapp_number: "9876543210",
        preferred_channel: "WHATSAPP",
        address: null,
      },
    });
  });

  it("accepts a different WhatsApp number", () => {
    const r = parseCustomer({ ...base, whatsappNumber: "+91 91234 56789" });
    expect(r.ok && r.row.whatsapp_number).toBe("9123456789");
  });

  it("forces SMS when the customer is not on WhatsApp", () => {
    const r = parseCustomer({ ...base, notOnWhatsapp: true, preferredChannel: "WHATSAPP" });
    expect(r.ok && r.row).toMatchObject({ whatsapp_number: null, preferred_channel: "SMS" });
  });

  it("reports field errors", () => {
    const r = parseCustomer({ ...emptyCustomerForm, mobile: "123", whatsappNumber: "12" });
    expect(r).toEqual({
      ok: false,
      fieldErrors: {
        name: "Enter the customer's name",
        mobile: "Enter a valid 10-digit mobile number",
        whatsappNumber: "Enter a valid 10-digit WhatsApp number",
      },
    });
  });
});
