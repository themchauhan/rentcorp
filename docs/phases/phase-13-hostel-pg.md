# Phase 13 — Hostel / PG business type

Owner decisions (2026-10-05):

- **Same app** with a **business type** per business (Tent house | Hostel/PG),
  chosen by the super admin when creating it and never changed afterwards.
  Each type sees its own menus.
- Rent **per bed or per whole room**, priced by the owner when setting up rooms.
- Rent is due on the **joining date every month**. The last month is charged
  in full, and the owner can add a discount.
- Electricity is a **fixed monthly amount**.
- Food is **meal plans** (owner-defined, ₹/month); a resident has one or none.
- **Deposit + notice + move-out settlement**: dues − deposit (+ deductions) →
  refund or amount to collect.
- **ID proof photos** are uploaded, stored privately, and can be deleted on
  request.

Branch: `hostel-pg`.

## Tasks

- [x] `tenants.business_type` (fixed once created), chosen on the super
      admin's New business form and shown on the list and business page
- [x] Guards: `requireTenantMember/ActiveTenant/TenantAdmin({ type })`.
      Tent routes (bookings, items, customers) 404 for a PG and PG routes 404
      for a tent house. In the database, writes to PG tables need
      `private.writable_pg_tenant_id()`
- [x] Per-type navigation: Home, Rooms, Residents, Complaints, More
- [x] Rooms and beds (`pg_create_room`), maintenance flags, rooms grid with
      Vacant / Occupied / Notice / Maintenance and dues badges
- [x] Hostel setup: meal plans, electricity, deposit and notice defaults
- [x] Move-in (`pg_move_in`): resident (shared `rental_customers`) plus
      details (occupation, emergency contact, ID type), bed or room, meal
      plan, joining date and deposit. Only the owner can set a different rent
- [x] Rates snapshotted per stay (`pg_stay_rates`); changes apply only from
      a future due date (`pg_change_rates`, owner only, audit-logged)
- [x] Dues engine `src/lib/pg-dues.ts` plus its SQL mirror
      `private.pg_stay_balance_paise` / `pg_stay_final_paise`
- [x] Payments: rent, deposit, refund (refund is owner only). Payments are
      append-only; mistakes are reversed by the owner. Extra charges and
      discounts carry a reason (owner)
- [x] Notice / withdraw notice / move-out settlement with deductions
      (`pg_settle_move_out`, owner) / cancel a mistaken move-in
- [x] One-tap "Rent due" and "Payment receipt" messages (wording editable
      in Settings), logged against the stay (`message_log.pg_stay_id`)
- [x] ID photos:
      - private bucket `resident-ids`
      - uploads go through `/api/id-photos` with the user's own session; the
        browser shrinks them first and the server checks type, size and
        magic bytes
      - viewed only through `/api/id-photos/[id]` (no-store)
      - the owner can delete permanently; the record is kept as "deleted"
- [x] Complaints: category, urgent, resident or room, Open → In progress →
      Resolved, with who and when stamped by the database
- [x] PG Home: occupancy, vacant, rent due today, overdue, leaving this
      week, open complaints. PG Reports: collections, outstanding, deposits
      held, occupancy by room, complaints
- [x] `delete_test_business()` also removes the PG tables, and now the
      WhatsApp tables, which it previously missed

- [x] Storage kept small for the free plan:
      - the browser turns every ID photo into a ~1280px JPEG (usually
        150–300 KB)
      - the bucket and the server refuse anything over 2 MB
      - at most 4 photos are kept per resident; deleting one frees a slot
      - so 1 GB of Storage holds roughly 4,000–6,000 photos

## Tests

- [x] pgTAP `97_hostel_pg` (55 checks):
      - PG↔PG and tent↔PG isolation
      - staff vs owner rights
      - no double-booking of a bed, room or person
      - maintenance blocks move-in
      - rate snapshot survives a room price change
      - future-due-date rule for rate changes
      - SQL dues for the seed residents
      - payment, refund and reversal rules
      - settlement maths
      - message log subject
      - complaint stamping
      - ID photo folder rule and Storage policies
      - business type is immutable
- [x] Vitest `src/lib/pg-dues.test.ts`:
      - month-end clamping (31 Jan, leap year)
      - oldest-first allocation, part paid, credit, reversals
      - mid-stay rate change
      - deposit kept separate
      - move-out stops charges
      - settlement: refund, collect, settled
- [x] Playwright `e2e/hostel-pg.spec.ts` (phone + desktop):
      - per-type screens and 404s
      - PG home
      - room + meal plan setup → staff move-in → rent → receipt sent and logged
      - notice → settlement with deduction → refund → bed vacant
      - ID photo upload, view, other PG blocked, oversize refused, delete
      - complaint raise/resolve
      - invalid input
      - another PG blocked, including a forged stay id
      - staff blocked from owner screens
      - super admin creates a PG

## Manual test steps (360px)

Steps 1–3 were run by hand on 2026-10-05. The same flows in steps 4–7 run
in `e2e/hostel-pg.spec.ts` on a phone-sized screen.

1. Log in as **9000000401** (Demo PG Owner D, password `Demo@1234`).
   Home shows 50% occupied, 2 vacant, Meera due today, Kabir 44 days late,
   Rohan leaving, and 2 open complaints.
2. Rooms → Add room "105", per bed, ₹5,000, 2 beds. Tap Bed A → Move in a
   test resident with a meal plan. The resident page shows the first month
   as due.
3. Record the payment → the month shows Paid. Send the receipt on WhatsApp
   (it opens WhatsApp and appears under Messages).
4. Record notice, then Move-out settlement with a deduction. The page shows
   the refund due. Record the refund → Settled; the bed is Vacant on Rooms.
5. Upload an ID photo; it shows. Delete it permanently → it disappears.
6. Complaints → New → resolve it.
7. Log in as **9000000101** (tent house): no Rooms tab; `/rooms` shows Page
   not found.

## Going live (needs you)

1. `npx supabase db push` for migrations `20261006000100`, `…0200`, `…0300`,
   `…0400`.
   The third one creates the private Storage bucket `resident-ids`
   (Storage is included in the free plan).
2. Super admin → New business → choose **Hostel / PG**.
3. No new environment variables.
