# Phase 3 — Customers and bookings

## Tasks

- [ ] `rental_customers` table + RLS: name, mobile, whatsapp_number
      (defaults to mobile, can be cleared if not on WhatsApp),
      preferred_channel (`WHATSAPP`|`SMS`), address
- [ ] Duplicate warning on new customer creation (name + mobile match)
- [ ] `rental_orders` + `rental_order_items`: pick customer, pick
      items and quantities, set event_start_date and
      expected_return_date
- [ ] Rate snapshotting: `rate_amount_snapshot`/`rate_unit_snapshot`
      copied from the catalog at creation time, never re-read live
- [ ] Booking total calculated live while picking items (no manual
      amount entry)
- [ ] Optional booking-level discount at creation: flat ₹ or %, with
      optional reason (`discount_type`, `discount_value`,
      `discount_reason` on `rental_orders`); audit-logged
- [ ] Booking detail view: items, quantities, rate, running status
- [ ] Booking creation is fast on a phone: searchable item picker,
      +/- quantity steppers, minimal typing

## Tests

- [ ] Happy path: create a booking, view it, see correct snapshotted
      rates even after the catalog rate is later changed
- [ ] Cross-tenant: booking creation rejects a customer_id or
      rental_item_id from another tenant even if forged in the
      request

## Acceptance criteria

- A booking can be created with multiple items and quantities, and
  its stored rates never change even if the catalog rate changes
  afterward
