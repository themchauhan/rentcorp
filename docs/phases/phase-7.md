# Phase 7 — Returns and billing

## Tasks

- [ ] `rental_returns`: record quantity returned per order item,
      timestamp, condition notes; supports partial/staggered returns
- [ ] Booking status transitions: ACTIVE → PARTIALLY_RETURNED →
      RETURNED, or → OVERDUE when past expected_return_date with items
      still out
- [ ] `rental_payments`: amount, mode, received_by, received_at, note
- [ ] Add/change/remove the booking discount at settlement (ADMIN or
      STAFF), shown with old → new value and who changed it; locked
      once the booking is closed
- [ ] Receptionist/staff can add payments, not delete them; admin-only
      reversal entries, audit-logged
- [ ] Booking can only close (RETURNED + settled) when all items are
      returned and amount due is zero
- [ ] On full return, show the Phase 5 send panel with the
      return/final bill message (WhatsApp / SMS / Copy)

## Tests

- [ ] Partial return updates status and stops accrual only for the
      returned items
- [ ] A booking cannot be marked fully closed while amount due > 0
- [ ] A discount given at settlement reduces amount due correctly and
      is audit-logged; discount cannot be edited after close
- [ ] Cross-tenant: payment/return entry rejects an order_id from
      another tenant

## Acceptance criteria

- A booking can go from active, through a partial return, to fully
  returned and settled, with an accurate paper trail at each step
