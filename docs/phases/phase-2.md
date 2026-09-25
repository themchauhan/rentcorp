# Phase 2 — Item catalog

## Tasks

- [ ] `rental_items` table + RLS
- [ ] Create/edit/deactivate items: name, category, unit_label,
      total_quantity_owned, rate_amount (price), rate_unit
      (per day / per event) — ADMIN only; STAFF can view
- [ ] Mobile-friendly item add/edit form: numeric keypad for price and
      quantity, quick category pick
- [ ] Item list with search/filter by category
- [ ] Deactivating an item doesn't delete it (past bookings still
      reference it via the snapshot, not a live join)

## Tests

- [ ] Happy path: create, edit, deactivate an item
- [ ] Cross-tenant: Tenant A cannot see or edit Tenant B's catalog

## Acceptance criteria

- Owner/admin can manage their full item catalog with rates, ready to
  be picked into a booking in Phase 3
