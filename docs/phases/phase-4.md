# Phase 4 — Amount-due calculation engine

Engine: `computeAmountDue()` in `src/lib/amount-due.ts` (pure, integer
paise). Rules, all documented at the top of that file:
1. PER_DAY: every IST calendar day out counts, first and last day
   included (12 → 14 Oct = 3 days; same day = 1). Any part of a day is a
   full day.
2. PER_EVENT: charged once for the booked quantity once the booking has
   started, even if returned early.
3. Each returned batch stops accruing on its own return date (that day
   still counts); items still out accrue to the as-of date.
4. Nothing accrues before the start date; cancelled bookings accrue
   nothing.
5. One booking-level discount on the gross (flat capped at gross; % half
   up, grows with gross).
6. Amount due = max(0, net − payments); overpayment shows as credit. The
   security deposit is not part of these figures.

Returns and payments are inputs to the engine now and get recorded in
Phase 7; until then they are empty.

## Tasks

- [x] Pure function, unit-tested independent of the UI: given an
      order + a reference date (today, or a return date), return
      amount due per item and total
- [x] Partial-day rounding rule chosen and documented explicitly
      (any part of a day counts as a full day — see rules above)
- [x] Once an order item is (partially) returned, it stops accruing
      from its own `returned_at`, not the whole order's return date
- [x] Booking-level discount applied after gross: FLAT capped at
      gross; PERCENT of gross (grows as gross grows); all maths in
      integer paise, % rounded to nearest paisa (half up)
- [x] Output includes gross, discount, net, payments, amount due
- [x] Displayed on the booking detail view, refreshed on load

## Tests

- [x] Same-day return: amount due matches a single day's rate
- [x] Multi-day active booking: amount due increases correctly day by
      day
- [x] Partial return mid-rental: returned items stop accruing while
      remaining items continue
- [x] Flat discount larger than gross → amount due floors at zero
      before payments, never negative
- [x] % discount on a multi-day booking grows day by day with gross
- [x] Rounding: odd-paise % discounts round correctly (half up)

## Acceptance criteria

- Amount due for a booking matches hand-computed examples for all
  three test cases above, and updates correctly as days pass

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000102`
2. Bookings → #1 (starts today): "Amount due today ₹2,500 · Day 1 of 3"
   (100 chairs × ₹10 + ₹1,500 shamiana). The list shows "₹2,500 due
   today". Tomorrow it will read ₹3,500.
3. Create a booking starting tomorrow → "₹0 · Nothing is due yet", the
   list shows its planned total
4. Unit tests (`npm test`) cover same-day return, day-by-day growth,
   partial/staggered returns, discounts, rounding and credit
