# Phase 7 — Returns and billing

Decisions (confirmed with the owner 2026-09-26):
- Returns can be **backdated** (from the start date up to today); charges
  stop on the chosen date. Each return records who entered it and when.
- Payments of any amount are accepted; paying more than is due (e.g. an
  advance) shows as **customer credit**.
- Owners can **cancel** a booking made by mistake (with a reason) if
  nothing has been returned yet; nothing is deleted, charges stop,
  payments stay recorded.

Enforced in the database (migration `…0800`): return quantity/date
limits, status follows returns automatically, reversals owner-only and
never more than the payment, discount changes only while open, close
only when everything is back and `private.final_balance_paise()` (SQL
mirror of the TS engine, cross-checked by tests) is ≤ 0, no edits or
deletes of returns/payments. The security deposit stays separate from
the bill.

## Tasks

- [x] `rental_returns`: record quantity returned per order item,
      timestamp, condition notes; supports partial/staggered returns
- [x] Booking status transitions: ACTIVE → PARTIALLY_RETURNED →
      RETURNED (automatic from returns), OVERDUE shown when past
      expected_return_date with items still out (computed on read,
      Phase 6), CANCELLED by the owner; "Closed" once settled
- [x] `rental_payments`: amount, mode, received_by, received_at, note
      (kind PAYMENT/REVERSAL; reversals point at the payment they undo)
- [x] Add/change/remove the booking discount at settlement (ADMIN or
      STAFF), shown with old → new value and who changed it; locked
      once the booking is closed
- [x] Receptionist/staff can add payments, not delete them; admin-only
      reversal entries, audit-logged
- [x] Booking can only close (RETURNED + settled) when all items are
      returned and amount due is zero
- [x] Home lists "Returned, payment pending" bookings
- [x] On full return, show the Phase 5 send panel with the
      return/final bill message (WhatsApp / SMS / Copy)

## Tests

- [x] Partial return updates status and stops accrual only for the
      returned items
- [x] A booking cannot be marked fully closed while amount due > 0
- [x] A discount given at settlement reduces amount due correctly and
      is audit-logged; discount cannot be edited after close
- [x] Cross-tenant: payment/return entry rejects an order_id from
      another tenant (`supabase/tests/70_returns_payments.test.sql`,
      `e2e/returns.spec.ts`)
- [x] Invalid input: bad amount, no quantity, over-return, future or
      pre-start return date, reversal larger than payment
- [x] Owner-only: reversals and cancelling (staff refused)

## Acceptance criteria

- A booking can go from active, through a partial return, to fully
  returned and settled, with an accurate paper trail at each step

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000102` (Staff A)
2. New booking for a new customer: start 3 days ago, return today, 10
   Plastic chairs + 1 Shamiana → amount due ₹1,900
3. Record return: 4 chairs, returned 2 days ago, note → "Partly
   returned", "4 of 10 back", amount due ₹1,820
4. Record payment ₹1,000 UPI → due ₹820
5. Discount 10% "regular customer" → due ₹638, "Set by Demo Staff A"
6. Record return → "Everything is back" → "Balance to collect ₹638";
   "Send final bill" message shows "Balance: ₹638"; Home lists it under
   "Returned, payment pending"
7. Record payment ₹638 → due ₹0 → Close booking → "Closed"; no more
   payment/discount forms; Payments and Returns history show every step
8. As Owner A (`9000000101`): reverse a payment (reason required);
   cancel a not-yet-returned booking (reason required)
