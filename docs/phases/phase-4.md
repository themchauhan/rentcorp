# Phase 4 — Amount-due calculation engine

## Tasks

- [ ] Pure function, unit-tested independent of the UI: given an
      order + a reference date (today, or a return date), return
      amount due per item and total
- [ ] Partial-day rounding rule chosen and documented explicitly
      (e.g. any part of a day counts as a full day)
- [ ] Once an order item is (partially) returned, it stops accruing
      from its own `returned_at`, not the whole order's return date
- [ ] Booking-level discount applied after gross: FLAT capped at
      gross; PERCENT of gross (grows as gross grows); all maths in
      integer paise, % rounded to nearest paisa (half up)
- [ ] Output includes gross, discount, net, payments, amount due
- [ ] Displayed on the booking detail view, refreshed on load

## Tests

- [ ] Same-day return: amount due matches a single day's rate
- [ ] Multi-day active booking: amount due increases correctly day by
      day
- [ ] Partial return mid-rental: returned items stop accruing while
      remaining items continue
- [ ] Flat discount larger than gross → amount due floors at zero
      before payments, never negative
- [ ] % discount on a multi-day booking grows day by day with gross
- [ ] Rounding: odd-paise % discounts round correctly (half up)

## Acceptance criteria

- Amount due for a booking matches hand-computed examples for all
  three test cases above, and updates correctly as days pass
