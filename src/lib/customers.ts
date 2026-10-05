import { z } from "zod";
import { normalizeIndianMobile } from "./auth/mobile";

export type Channel = "WHATSAPP" | "SMS";

export type CustomerFormInput = {
  name: string;
  mobile: string;
  /** Blank = same as mobile. */
  whatsappNumber: string;
  notOnWhatsapp: boolean;
  /** Customer agreed to receive WhatsApp messages from the business. */
  whatsappOptIn: boolean;
  preferredChannel: Channel;
  address: string;
};

export type CustomerFormField = keyof CustomerFormInput;

export type CustomerRow = {
  name: string;
  mobile: string;
  whatsapp_number: string | null;
  whatsapp_opt_in: boolean;
  preferred_channel: Channel;
  address: string | null;
};

export function readCustomerForm(formData: FormData, prefix = ""): CustomerFormInput {
  const get = (k: string) => String(formData.get(prefix + k) ?? "");
  return {
    name: get("name"),
    mobile: get("mobile"),
    whatsappNumber: get("whatsappNumber"),
    notOnWhatsapp: formData.get(prefix + "notOnWhatsapp") === "on",
    whatsappOptIn: formData.get(prefix + "whatsappOptIn") === "on",
    preferredChannel: get("preferredChannel") === "SMS" ? "SMS" : "WHATSAPP",
    address: get("address"),
  };
}

/** Validates a customer form into a database row. */
export function parseCustomer(
  input: CustomerFormInput,
):
  | { ok: true; row: CustomerRow }
  | { ok: false; fieldErrors: Partial<Record<CustomerFormField, string>> } {
  const fieldErrors: Partial<Record<CustomerFormField, string>> = {};
  const name = z.string().trim().min(1).max(120).safeParse(input.name);
  if (!name.success)
    fieldErrors.name = input.name.trim() ? "Name is too long" : "Enter the customer's name";

  const mobile = normalizeIndianMobile(input.mobile);
  if (!mobile) fieldErrors.mobile = "Enter a valid 10-digit mobile number";

  let whatsapp: string | null = null;
  if (!input.notOnWhatsapp) {
    whatsapp = input.whatsappNumber.trim() ? normalizeIndianMobile(input.whatsappNumber) : mobile;
    if (input.whatsappNumber.trim() && !whatsapp) {
      fieldErrors.whatsappNumber = "Enter a valid 10-digit WhatsApp number";
    }
  }

  const address = input.address.trim();
  if (address.length > 500) fieldErrors.address = "Address is too long";

  if (!name.success || !mobile || Object.keys(fieldErrors).length)
    return { ok: false, fieldErrors };
  return {
    ok: true,
    row: {
      name: name.data,
      mobile,
      whatsapp_number: whatsapp,
      // Consent only means something with a WhatsApp number.
      whatsapp_opt_in: Boolean(whatsapp) && input.whatsappOptIn,
      // No WhatsApp number → SMS is the only option.
      preferred_channel: whatsapp ? input.preferredChannel : "SMS",
      address: address || null,
    },
  };
}

export const emptyCustomerForm: CustomerFormInput = {
  name: "",
  mobile: "",
  whatsappNumber: "",
  notOnWhatsapp: false,
  whatsappOptIn: false,
  preferredChannel: "WHATSAPP",
  address: "",
};
