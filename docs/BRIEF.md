# RentCorp SaaS — Product Brief

## Product goal

A tent-house owner rents out items (chairs, tables, tents, lights,
generators, utensils, etc.) for events. Today this is tracked on
paper or a register, with rate calculation and follow-up done from
memory. Replace that with a mobile-first app: pick items from a
catalog, and the app builds the itemized list with rates, rental
period, and total automatically. The owner then sends it to the
customer from their own phone — on WhatsApp, or as a normal SMS for
customers who aren't on WhatsApp — with one tap.

The app never sends messages by itself. It prepares the message; the
owner/staff presses send in their own WhatsApp or SMS app. No
messaging provider, no templates, no per-message cost.

This is a multi-tenant SaaS: one deployment serves many independent
tent-house businesses, each seeing only their own data.

**Hostels / PGs (phase 13, 2026-10-05).** The same app also serves
hostels and paying-guest houses. The super admin picks the business type
when creating a business (it can't change later), and each type sees its
own menus. A PG gets:

- rooms and beds, let per bed or as a whole room
- residents, moved in on a joining date (rent is due on that date every
  month)
- meal plans and a fixed monthly electricity charge, snapshotted per
  resident
- a deposit, notice and move-out settlement (dues − deposit + deductions
  → refund or amount to collect)
- maintenance complaints
- private ID-proof photos
- one-tap "Rent due" / "Payment receipt" messages

Details: `docs/phases/phase-13-hostel-pg.md`.

## Platform

- Mobile-first web app, installable as a PWA ("Add to Home Screen").
  Owners and staff use it almost entirely on their phones.
- Every screen is designed for a phone first (~360px wide), then
  scales up to desktop.
- No app-store app for MVP; a Play Store wrapper can come later.

## Roles

Everyone logs in with their **mobile number + password**. Accounts are
created by an admin (no public signup, no SMS/OTP); forgotten
passwords are reset by the owner (staff) or super admin (owners).


- **SUPER_ADMIN** — you, the SaaS owner. Create/manage tenant
  businesses, plans, trial/expiry, review payments.
- **ADMIN** (business owner) — manage item catalog, rates, view all
  bookings and payments, edit message wording, invite staff.
- **STAFF** — create bookings, record returns, record payments, send
  messages to customers.

## Core workflow

1. Staff creates a booking: pick a customer (or add new), pick items
   and quantities from the catalog, set the event/start date.
2. The system snapshots the rate for each item at booking time — a
   later catalog rate change never affects an existing booking. The
   total is calculated automatically; staff never type amounts.
   Optionally, a discount (flat ₹ or %) can be applied to the whole
   booking — at creation or any time later, e.g. when the customer
   bargains at final settlement.
3. On save, the app shows the ready-made **booking message**
   (itemized list, rate per item, total, start date, advance/balance)
   with two buttons: **Send on WhatsApp** and **Send SMS**, plus
   **Copy**. The customer's preferred channel is highlighted.
4. At any time while the booking is open, staff can tap **Send amount
   due** to generate a fresh message with the amount due as of today
   (e.g. when the customer calls asking) and send it the same way.
5. When the customer returns items, staff records the return
   (supports partial/staggered returns — some items back, others
   still out).
6. On full return, the app prepares the **return/final bill
   message** to send the same way.
7. Staff records payment(s) received manually (amount, mode,
   received-by — no payment gateway).
8. Booking closes when all items are returned and fully settled.

## Data model

| Table | Key fields |
|---|---|
| `tenants` | id, name, phone, email, status, plan, trial_ends_at, subscription_ends_at |
| `profiles` | id (Auth user), tenant_id, name, mobile (login id), role (ADMIN/STAFF), status |
| `platform_admins` | user_id (Auth user), name — SUPER_ADMIN accounts, not tied to a tenant |
| `rental_items` | id, tenant_id, name, category, unit_label, total_quantity_owned, rate_paise (integer paise), rate_unit (`PER_DAY`\|`PER_EVENT`), active |
| `rental_customers` | id, tenant_id, name, mobile, whatsapp_number (nullable = not on WhatsApp; defaults to mobile), preferred_channel (`WHATSAPP`\|`SMS`), address |
| `rental_orders` | id, tenant_id, customer_id, order_date, event_start_date, expected_return_date, status (`ACTIVE`\|`PARTIALLY_RETURNED`\|`RETURNED`\|`OVERDUE`\|`CANCELLED`), closed_at/by, cancelled_at/by, cancel_reason, booking_number (per business), event_start_time (optional), security_deposit_paise (nullable), discount_type (`NONE`\|`FLAT`\|`PERCENT`), discount_value, discount_reason (nullable), discount_updated_by, discount_updated_at, notes, created_by |
| `rental_order_items` | id, tenant_id, rental_order_id, rental_item_id, quantity, item_name_snapshot, unit_label_snapshot, rate_paise_snapshot, rate_unit_snapshot |
| `rental_returns` | id, tenant_id, rental_order_id, rental_order_item_id, quantity_returned, returned_on (IST date, may be backdated), condition_notes, recorded_by, recorded_at |
| `rental_payments` | id, tenant_id, rental_order_id, kind (`PAYMENT`\|`REVERSAL`), amount_paise (negative for reversals), mode (`CASH`\|`UPI`\|`CARD`\|`OTHER`), reverses_payment_id, received_by, received_at, note |
| `message_log` | id, tenant_id, rental_order_id, message_type (`BOOKING_CONFIRMATION`\|`AMOUNT_DUE`\|`RETURN_CONFIRMATION`), channel (`WHATSAPP`\|`SMS`\|`COPY`), to_number, body_snapshot, amount_due_snapshot_paise, sent_by, opened_at |
| `message_templates` | tenant_id, message_type, body (owner's custom wording; none = default) |
| `whatsapp_connections` | tenant_id (unique), waba_id, phone_number_id, display_phone_number, status — token in Vault via `private.whatsapp_credentials` |
| `audit_logs` | id, tenant_id, user_id, action, target_type, target_id, metadata, created_at |
| `subscription_payments` | id, tenant_id, amount_paise, payment_date, payment_method (`UPI`\|`BANK_TRANSFER`\|`CASH`\|`OTHER`), reference_number, period_start, period_end, notes, recorded_by |

Every table carries `tenant_id`, derived server-side from the session,
never from the client. RLS scopes every query to it.

## Rate/amount-due calculation

- For each order item still out: `elapsed_units × quantity ×
  rate_amount_snapshot`, where `elapsed_units` is whole days (or
  events) from `event_start_date` to today (or to `returned_at` once
  returned).
- Once an item is partially returned, it stops accruing from its own
  `returned_at` — tracked per order item, not just per order.
- Gross = sum across items.
- Discount (one per booking, applied to the whole booking):
  - `FLAT`: a fixed rupee amount, capped at gross (never makes the
    bill negative).
  - `PERCENT`: 0–100% of gross. Because gross grows each day items
    are out, a % discount grows with it; a flat discount does not.
  - `NONE`: no discount.
- Total due = gross − discount − sum of `rental_payments`.
- All money is stored and calculated as integer paise, never floats;
  a % discount is rounded to the nearest paisa (half up). Displayed as
  ₹ with 2 decimals only where non-zero.
- **Day-count rule (decided):** PER_DAY items are charged for every IST
  calendar day they are out, counting both the first and last day —
  any part of a day counts as a full day (12 → 14 Oct = 3 days,
  same-day = 1). PER_EVENT items are charged once per booking.
  Implemented and unit-tested in `src/lib/pricing.ts`.
- Discount value: FLAT in paise; PERCENT in basis points (1000 = 10%).

## Automatic WhatsApp (Meta Cloud API)

**Optional add-on (2026-10-05).** Off by default per business; the super
admin switches it on when a client asks for it (Meta charges per message).
Without it the business sees only the one-tap buttons — no WhatsApp
settings, consent checkbox or automatic button — and no automatic send or
9 PM message ever goes out for it. Setup steps for RentCorp and the client:
`docs/whatsapp/client-onboarding.md`.

Added 2026-10-01 at the owner's request (see
`RentCorp_WhatsApp_Integration_Presentation.pptx`), alongside the manual
buttons below.

- Each business connects **its own** WhatsApp Business number (never a
  central RentCorp number). For now the super admin enters the connection
  (WABA ID, phone number ID, access token) on the business's page; Meta's
  Embedded Signup comes later.
- Messages use fixed, Meta-approved templates (`docs/whatsapp/templates.md`),
  sent server-side; tokens are stored in Supabase Vault.
- Only customers who agreed to receive WhatsApp messages get automatic
  messages; replying STOP opts them out.
- Meta's webhook reports sent / delivered / read / failed, shown in the
  booking's message history.
- Owners can connect their own number in Settings → WhatsApp (paste the
  details from Meta, or Meta's "Connect with Meta" button once RentCorp is
  an approved Tech Provider).
- Automatic messages (each switchable per business):
  1. **Booking details** right after a booking is saved.
  2. **9 PM IST balance** every evening to every customer with money due —
     items out (incl. overdue) get the amount due, returned-but-unpaid get
     the final bill — until settled. At most one per booking per day.
- Businesses that don't connect keep the one-tap buttons.

## Pricing and discounts

- Owner (ADMIN) adds items and sets each item's price and rate unit
  (per day / per event) in the catalog. Prices can be changed any
  time; existing bookings keep their snapshotted rates.
- Booking totals, running amount due, and final bill are always
  calculated by the app — no manual amount entry.
- Discount: one per booking, flat ₹ or %, can be set or changed at any
  time while the booking is open by ADMIN or STAFF, with an optional
  reason. Every set/change/removal is audit-logged with old value, new
  value, who, and when; the owner can see this history on the
  booking. Discounts cannot be changed once a booking is closed.
- Messages show the discount as its own line (e.g. "Discount (10%):
  −₹750") between gross and total.

## Customer messaging (manual send, no provider)

The app composes the message; the user's own phone sends it. No
WhatsApp Business API, no SMS gateway, no templates to approve, no
per-message cost.

- **Send on WhatsApp** — opens `https://wa.me/<number>?text=<message>`
  (country code, digits only), which opens WhatsApp with the chat and
  message pre-filled. The user taps send.
- **Send SMS** — opens the phone's SMS app via an `sms:` link with the
  number and message pre-filled. Note the platform difference: Android
  uses `sms:<number>?body=<message>`, iOS uses
  `sms:<number>&body=<message>`. Detect and handle both.
- **Copy** — copies the message text, as a fallback for any other app
  or if a link doesn't open.
- Messages are plain text; keep SMS versions compact (long itemized
  lists split into multiple SMS on the sender's plan, and many Indian
  prepaid plans cap SMS per day). Offer a shorter SMS format
  (summary + total) when the itemized text is long.
- Message wording comes from simple per-tenant text formats with
  placeholders (business name, customer name, items, gross, discount,
  total, dates, amount due), editable by ADMIN, with sensible defaults.
- Every tap on a send/copy button is written to `message_log` with the
  channel, recipient number, the exact message body, and the amount
  due at that moment. The app **cannot confirm delivery** — the log
  records that the message was prepared and handed to WhatsApp/SMS,
  not that it was received. The UI must say "Opened in WhatsApp/SMS",
  never "Delivered".

## Build phases

See `docs/phases/phase-N.md` for detailed tasks and acceptance
criteria.

- **Phase 0** — Validation with a real tent-house business (not code)
- **Phase 1a** — Scaffold, tooling, CI, mobile-first shell + PWA basics
- **Phase 1b** — Auth, roles, RLS, tenant guard, audit foundation
- **Phase 1c** — Super admin provisioning, staff invites, admin MFA
- **Phase 2** — Item catalog
- **Phase 3** — Customers and bookings, rate snapshotting
- **Phase 4** — Amount-due calculation engine
- **Phase 5** — Message builder + Send on WhatsApp / Send SMS
- **Phase 6** — Home screen: bookings still out, installable app polish
- **Phase 7** — Returns and billing
- **Phase 8** — Reports (open/overdue bookings, collections)
- **Phase 9** — Super admin dashboard, manual subscriptions
- **Phase 10** — Security hardening and pilot readiness

## Out of scope for MVP

Automated/scheduled message sending of any kind, WhatsApp Business
API or SMS gateway integration, online payment, security-deposit
accounting beyond a single stored amount, damage/insurance claims,
multi-warehouse/multi-location stock, a customer-facing self-service
portal, delivery/logistics tracking, a native app-store app.
