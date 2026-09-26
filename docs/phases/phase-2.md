# Phase 2 — Item catalog

## Tasks

- [x] `rental_items` table + RLS (owners write, all active members
      read; tenant_id from the session; no DELETE)
- [x] Create/edit/deactivate items: name, category, unit_label,
      total_quantity_owned, rate_amount (price), rate_unit
      (per day / per event) — ADMIN only; STAFF can view
- [x] Mobile-friendly item add/edit form: numeric keypad for price and
      quantity, quick category pick (suggested chips + the business's
      own categories; owners can type a new one)
- [x] Item list with search/filter by category
- [x] Deactivating an item doesn't delete it (past bookings still
      reference it via the snapshot, not a live join)

## Tests

- [x] Happy path: create, edit, deactivate an item
- [x] Cross-tenant: Tenant A cannot see or edit Tenant B's catalog
      (`supabase/tests/30_rental_items.test.sql`, `e2e/items.spec.ts`)
- [x] Invalid input: empty name/category, bad price, negative
      quantity, duplicate name; staff can't add or edit

## Acceptance criteria

- Owner/admin can manage their full item catalog with rates, ready to
  be picked into a booking in Phase 3

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000101` (Owner A)
2. Items: seed items listed with prices (e.g. Plastic chair ₹10 / piece
   per day); "Old wooden stage" only appears with "Show inactive"
3. Add item → tap a category chip or type a new one, quantity, unit
   chip, price `1500`, "per event" → Save → appears in the list
4. Open it → change price to `1750.50` → list shows ₹1,750.50
5. Deactivate → gone from the list; Show inactive → listed as
   Inactive; Reactivate → back
6. Search "plastic" and tap the "Lighting" chip → list filters
7. Log in as `9000000102` (Staff A): list visible, no Add item, rows
   not editable
8. Log in as `9000000201` (Owner B): none of Tenant A's items appear
