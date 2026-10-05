"use client";

import { useState } from "react";
import { Field } from "@/components/ui/form";
import type { Channel, CustomerFormField, CustomerFormInput } from "@/lib/customers";

/**
 * Customer inputs, shared by the customer form and the "new customer" part
 * of the booking form. `prefix` namespaces the field names.
 */
export function CustomerFields({
  initial,
  errors = {},
  prefix = "",
  showWhatsAppConsent = false,
  nameLabel = "Customer name",
}: {
  initial: CustomerFormInput;
  errors?: Partial<Record<CustomerFormField, string>>;
  prefix?: string;
  /** Only for businesses with the WhatsApp automation add-on. */
  showWhatsAppConsent?: boolean;
  nameLabel?: string;
}) {
  const [notOnWhatsapp, setNotOnWhatsapp] = useState(initial.notOnWhatsapp);
  const [channel, setChannel] = useState<Channel>(initial.preferredChannel);
  const effectiveChannel: Channel = notOnWhatsapp ? "SMS" : channel;

  return (
    <div className="space-y-4">
      <Field
        label={nameLabel}
        name={`${prefix}name`}
        defaultValue={initial.name}
        error={errors.name}
        autoComplete="off"
        required
      />
      <Field
        label="Mobile number"
        name={`${prefix}mobile`}
        type="tel"
        inputMode="numeric"
        defaultValue={initial.mobile}
        error={errors.mobile}
        autoComplete="off"
        required
      />
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input
          type="checkbox"
          name={`${prefix}notOnWhatsapp`}
          checked={notOnWhatsapp}
          onChange={(e) => setNotOnWhatsapp(e.target.checked)}
          className="h-5 w-5 accent-brand-700"
        />
        Not on WhatsApp
      </label>
      {showWhatsAppConsent && !notOnWhatsapp && (
        <label className="flex min-h-11 items-start gap-3 text-base">
          <input
            type="checkbox"
            name={`${prefix}whatsappOptIn`}
            defaultChecked={initial.whatsappOptIn}
            className="mt-1 h-5 w-5 accent-brand-700"
          />
          <span>
            Agreed to receive WhatsApp messages from us
            <span className="block text-xs text-stone-500">
              Needed for automatic WhatsApp messages.
            </span>
          </span>
        </label>
      )}
      {!notOnWhatsapp && (
        <Field
          label="WhatsApp number (leave blank if same as mobile)"
          name={`${prefix}whatsappNumber`}
          type="tel"
          inputMode="numeric"
          defaultValue={initial.whatsappNumber}
          error={errors.whatsappNumber}
          autoComplete="off"
        />
      )}
      <fieldset>
        <legend className="block text-sm font-medium text-stone-700">Send messages by</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["WHATSAPP", "SMS"] as Channel[]).map((c) => {
            const disabled = c === "WHATSAPP" && notOnWhatsapp;
            const selected = effectiveChannel === c;
            return (
              <label
                key={c}
                className={`flex min-h-12 items-center justify-center rounded-lg border font-medium ${
                  selected
                    ? "border-brand-700 bg-brand-50 text-brand-800"
                    : "border-stone-300 bg-white text-stone-700"
                } ${disabled ? "opacity-40" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name={`${prefix}preferredChannel`}
                  value={c}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => setChannel(c)}
                  className="sr-only"
                />
                {c === "WHATSAPP" ? "WhatsApp" : "SMS"}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${prefix}address`} className="block text-sm font-medium text-stone-700">
          Address (optional)
        </label>
        <textarea
          id={`${prefix}address`}
          name={`${prefix}address`}
          defaultValue={initial.address}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none"
        />
        {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
      </div>
    </div>
  );
}
