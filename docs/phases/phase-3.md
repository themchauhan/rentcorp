# Phase 3 — Customers and bookings

Decisions (confirmed with the owner 2026-09-26):
- **Day count:** PER_DAY items are charged for every calendar day they
  are out, counting both the first and last day (12 → 14 Oct = 3 days;
  same-day return = 1 day). PER_EVENT items are charged once. Rules live
  in `src/lib/pricing.ts`.
- **Stock:** if a booking asks for more than is free on those dates
  (owned − other open bookings overlapping them), show a warning and let
  staff save anyway.
- Booking numbers are per business (#1, #2, …). Rates, item names and
  units are snapshotted by a database trigger; the app never sends them.

## Tasks

- [x] `rental_customers` table + RLS: name, mobile, whatsapp_number
      (defaults to mobile, can be cleared if not on WhatsApp),
      preferred_channel (`WHATSAPP`|`SMS`), address
- [x] Duplicate warning on new customer creation (same mobile already
      on file — shows the existing name; "Use existing" or "Save anyway")
- [x] Stock warning when quantity exceeds what's free on the dates
- [x] `rental_orders` + `rental_order_items`: pick customer, pick
      items and quantities, set event_start_date and
      expected_return_date
- [x] Rate snapshotting: `rate_paise_snapshot`/`rate_unit_snapshot`
      (plus item name/unit snapshots)
      copied from the catalog at creation time, never re-read live
- [x] Booking total calculated live while picking items (no manual
      amount entry)
- [x] Optional booking-level discount at creation: flat ₹ or %, with
      optional reason (`discount_type`, `discount_value`,
      `discount_reason` on `rental_orders`); audit-logged
- [x] Booking detail view: items, quantities, rate, running status
- [x] Booking creation is fast on a phone: searchable item picker,
      +/- quantity steppers, minimal typing

## Tests

- [x] Happy path: create a booking, view it, see correct snapshotted
      rates even after the catalog rate is later changed
- [x] Cross-tenant: booking creation rejects a customer_id or
      rental_item_id from another tenant even if forged in the
      request (composite foreign keys; `supabase/tests/40_bookings.test.sql`,
      `e2e/bookings.spec.ts`)
- [x] Invalid input: no customer/items, return before start, bad
      discount, bad customer fields

## Acceptance criteria

- A booking can be created with multiple items and quantities, and
  its stored rates never change even if the catalog rate changes
  afterward

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000102` (Staff A)
2. Bookings → seeded Booking #1 (Demo Customer Ravi): 100 chairs ₹10/day
   + shamiana ₹1,500/event, 3 days → ₹4,500
3. New booking → pick "Demo Customer Ravi" → start tomorrow, return in 3
   days (shows "3 days") → add chairs with +/− or typing → pick "% off"
   10 → the sticky total updates → Save → booking page matches
4. As Owner A (`9000000101`), change the chair price in Items → the
   booking still shows the old rate and total
5. New booking → New customer with mobile `9111111101` → duplicate
   warning → "Use Demo Customer Ravi"
6. Ask for 5 generators (2 owned) → stock warning → Save anyway
7. Customers → Add customer, tick "Not on WhatsApp" → listed as SMS only
8. As Owner B (`9000000201`): none of Tenant A's bookings/customers
   appear, and their links show "not found"
