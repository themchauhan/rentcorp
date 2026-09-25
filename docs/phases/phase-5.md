# Phase 5 — Message builder and Send on WhatsApp / Send SMS

No messaging provider. The app composes the message; the user's own
phone sends it.

## Tasks

- [ ] Pure, unit-tested message builder:
      `buildMessage(type, order, amountDue, tenantFormat, channel)`
      returning plain text for `BOOKING_CONFIRMATION`, `AMOUNT_DUE`,
      `RETURN_CONFIRMATION` (the return message is wired up in
      Phase 7)
- [ ] Compact SMS variant (summary + total) used when the itemized
      text is too long for a reasonable SMS
- [ ] Per-tenant editable message formats with placeholders (business
      name, customer name, items, gross, discount, total, dates,
      amount due, balance); discount line shown only when a discount
      exists,
      ADMIN-only, with defaults seeded for new tenants
- [ ] Link builders: `wa.me/<digits>?text=` for WhatsApp; `sms:` link
      handling both Android (`?body=`) and iOS (`&body=`) formats;
      phone numbers normalised to country code + digits
- [ ] Send panel shown after booking save and on the booking detail
      page: message preview, **Send on WhatsApp**, **Send SMS**,
      **Copy**; customer's `preferred_channel` highlighted; WhatsApp
      button hidden/disabled if the customer has no WhatsApp number
- [ ] **Send amount due** button on the booking detail page, using the
      Phase 4 calculation as of now
- [ ] `message_log` table + RLS: tenant_id, rental_order_id,
      message_type, channel, to_number, body_snapshot,
      amount_due_snapshot, sent_by, opened_at — written server-side
      on every send/copy tap
- [ ] UI wording says "Opened in WhatsApp/SMS", never "Delivered"

## Tests

- [ ] Message builder: correct items, rates, totals, dates, and ₹
      formatting for each message type; SMS compact variant kicks in
      for long lists
- [ ] Link builders: number normalisation (spaces, +91, leading 0),
      URL-encoding of message text, Android vs iOS `sms:` format
- [ ] Every send/copy tap creates a `message_log` row with the exact
      body sent
- [ ] Cross-tenant: a log entry or message cannot be created for an
      order id belonging to another tenant

## Manual test steps

- On a real Android phone and a real iPhone: create a booking, tap
  Send on WhatsApp (chat opens pre-filled), tap Send SMS (SMS app
  opens pre-filled), tap Copy; confirm each appears in the log

## Acceptance criteria

- A booking produces a correct itemized message that opens pre-filled
  in WhatsApp and in the SMS app on both Android and iOS
- Send amount due shows the correct current amount
