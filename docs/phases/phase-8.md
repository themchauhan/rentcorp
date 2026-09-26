# Phase 8 — Reports

Owner-only page at More → Reports (`src/app/(app)/reports/page.tsx`);
aggregation in `src/lib/reports.ts` (unit-tested). Collections are net of
reversals; days are IST. "Discounts given" counts bookings whose discount
was last set in the range, attributed to whoever set it, valued as of
today (final amount once everything is back).

## Tasks

- [x] Open bookings list (out now, on time) with amount due
- [x] Overdue bookings list (OVERDUE), sorted by days overdue
- [x] Today's collections by payment mode and by staff member
- [x] Simple date-range collections summary
- [x] Discounts given in a date range, by staff member

## Tests

- [x] Cross-tenant: reports never include another tenant's bookings
      or payments (`e2e/reports.spec.ts`; RLS on every source table)
- [x] Exact before/after totals for a payment, discount and overdue
      booking; staff can't open reports; date-range clamping unit-tested

## Acceptance criteria

- Owner/admin can see, at a glance, what's overdue and what's been
  collected today

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000101` (Owner A)
2. More → Reports: "Collected today ₹0", Overdue (0), "Out now, on
   time" lists Demo Customer Ravi #1 with today's amount due
3. Record a ₹500 UPI payment on any booking → Reports shows ₹500 today,
   under UPI and under the staff member who recorded it
4. Give a discount → "Discounts given" shows it under your name
5. Change the From/To dates → the collections summary follows
6. Staff (`9000000102`) opening /reports → "You don't have access"
