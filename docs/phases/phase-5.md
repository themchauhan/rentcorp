# Phase 5 — Message builder and Send on WhatsApp / Send SMS

No messaging provider. The app composes the message; the user's own
phone sends it.

Implementation notes:
- Builder: `src/lib/messages.ts`; links: `src/lib/message-links.ts`;
  per-booking context: `src/lib/booking-messages.ts`.
- SMS text uses "Rs." instead of ₹ (₹ forces Unicode SMS = 70 chars per
  message) and switches to a one-line summary above 459 characters.
- The send buttons are plain links (instant app switch on a phone); each
  tap is logged via `POST /api/message-log` with `keepalive`. Recipient
  number and amount due are taken from the database, not the request.
- Per-business wording lives in `message_templates` (no row = default
  wording); owners edit it in Settings → Message wording.
- Each send is recorded in `message_log` and also as a `message.opened`
  audit event.

## Tasks

- [x] Pure, unit-tested message builder:
      `buildMessage(type, order, amountDue, tenantFormat, channel)`
      returning plain text for `BOOKING_CONFIRMATION`, `AMOUNT_DUE`,
      `RETURN_CONFIRMATION` (the return message is wired up in
      Phase 7)
- [x] Compact SMS variant (summary + total) used when the itemized
      text is too long for a reasonable SMS
- [x] Per-tenant editable message formats with placeholders (business
      name, customer name, items, gross, discount, total, dates,
      amount due, balance); discount line shown only when a discount
      exists, ADMIN-only; defaults built in (no seeding needed)
- [x] Link builders: `wa.me/<digits>?text=` for WhatsApp; `sms:` link
      handling both Android (`?body=`) and iOS (`&body=`) formats;
      phone numbers normalised to country code + digits
- [x] Send panel shown after booking save and on the booking detail
      page: message preview, **Send on WhatsApp**, **Send SMS**,
      **Copy**; customer's `preferred_channel` highlighted; WhatsApp
      button hidden/disabled if the customer has no WhatsApp number
- [x] **Send amount due** button on the booking detail page, using the
      Phase 4 calculation as of now
- [x] `message_log` table + RLS: tenant_id, rental_order_id,
      message_type, channel, to_number, body_snapshot,
      amount_due_snapshot_paise, sent_by, opened_at — written server-side
      on every send/copy tap
- [x] UI wording says "Opened in WhatsApp/SMS", never "Delivered"

## Tests

- [x] Message builder: correct items, rates, totals, dates, and ₹
      formatting for each message type; SMS compact variant kicks in
      for long lists
- [x] Link builders: number normalisation (spaces, +91, leading 0),
      URL-encoding of message text, Android vs iOS `sms:` format
- [x] Every send/copy tap creates a `message_log` row with the exact
      body sent
- [x] Cross-tenant: a log entry or message cannot be created for an
      order id belonging to another tenant

## Manual test steps

Done in a desktop/emulated browser (automated in `e2e/messages.spec.ts`):
booking confirmation and amount-due previews, WhatsApp link opens
`wa.me/91…` with the text, SMS link format and "Rs." text, Copy puts the
exact text on the clipboard, every tap appears under "Messages".

**Still to do on real phones (needs you):** on an Android phone and an
iPhone, open a booking → Send on WhatsApp (chat opens pre-filled) →
Send SMS (SMS app opens pre-filled) → Copy → all three appear under
"Messages" on the booking.

## Acceptance criteria

- A booking produces a correct itemized message that opens pre-filled
  in WhatsApp and in the SMS app on both Android and iOS
- Send amount due shows the correct current amount
