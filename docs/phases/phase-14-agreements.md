# Phase 14 — Agreements & renewals (Hostel / PG)

Owner decisions (2026-10-09):

- **Term:** the owner picks the length in months, default **11**. The end date is the start date plus N months minus one day, and the owner can edit it.
- **Renewal rent:** each agreement stores a yearly **increase %** (default 5). Renewing pre-fills the new rent and the owner confirms or edits it. The new rent starts on the **first due date in the new term that is after today**; months already due never change.
- **Lock-in:** recorded, warning only. If notice falls inside the lock-in, the app warns and the owner decides any deduction at move-out.
- **Alerts:** on PG Home and in Reports from **30 days** before the end (configurable), with a one-tap renewal message.

Built on `main` (test phase; the owner commits and pushes).

## Tasks

- [x] `pg_settings` defaults: length, lock-in, increase %, alert days (Hostel setup)
- [x] `pg_agreements`: one ACTIVE agreement per stay; RENEWED / ENDED kept as history; written only through these functions:
  - `pg_create_agreement`: any member
  - `pg_update_agreement`: owner
  - `pg_renew_agreement`: owner
  - `pg_set_agreement_document`: owner
- [x] Moving out or cancelling a stay ends its agreement (database trigger)
- [x] Move-in creates the agreement: months and lock-in prefilled; 0 skips it
- [x] Resident page Agreement card:
  - dates, lock-in, increase %
  - "Ends in n days" / "Expired" badge
  - view the document; upload or replace a PDF (≤ 5 MB) or a photo (shrunk, ≤ 2 MB)
  - Renew, with the suggested rent and the date it applies from
  - Edit dates
  - history of earlier terms
- [x] Lock-in warning on the notice form and at move-out settlement
- [x] "Agreement renewal" message (one tap, logged, wording editable)
- [x] PG Home "Agreements ending soon" (with the renewal message); Reports list for the next 60 days
- [x] Document routes:
  - `POST /api/agreements/[id]/document`: owner, user session, magic-byte check; the replaced file is deleted
  - `GET`: members of the business only, no-store
- [x] Fix: deleting a test business now also deletes its stored files (ID photos and agreements)
- [x] `ActionForm` leaves validation to the server, so the app's own error messages show

## Tests

- [x] pgTAP `98_pg_agreements` (31 checks):
  - another PG and tent houses are blocked
  - direct writes are revoked
  - staff can create but can't edit, renew or attach
  - end date and lock-in maths
  - one current agreement per stay
  - renewal chain; new rent only from a future due date in the new term; a late renewal waits for the next due date; meal and electricity carry over
  - a renewed term can't be renewed again
  - document folder rule
  - move-out ends the agreement
  - deleting a test business removes agreements
- [x] Vitest `src/lib/pg-agreements.test.ts`: end dates (month ends, leap year), lock-in, suggested rent rounding, first due date, alert states
- [x] Playwright `e2e/pg-agreements.spec.ts` (phone and desktop):
  - move-in creates an 11-month agreement
  - Home ending/expired list and the renewal message (logged)
  - renewal with +5% rent
  - PDF upload and view; oversized or fake files refused; another PG gets 404
  - lock-in warning
  - staff blocked
  - forged agreement id refused
  - invalid months and lock-in
  - settings defaults

## Manual test steps (360px)

Steps 1 and 2 (up to the suggested rent) were checked by hand on 2026-10-10; the
renewal, upload and lock-in flows run in `e2e/pg-agreements.spec.ts` on a phone screen.

1. Log in as **9000000401** (Demo PG Owner D). Home → "Agreements ending soon" shows Kabir (ends in 20 days) and Meera (expired 5 days ago).
2. Open Kabir → the Agreement card shows "Ends in 20 days". Renew shows the suggested ₹6,300 and the date it applies from. Tap Renew: a new term starts, and the summary shows "From <date>: rent ₹6,300".
3. Upload a PDF → "View PDF" opens it.
4. Open Aarav → the notice form shows the lock-in warning.
5. More → Settings → Hostel setup → the agreement defaults save.

## Going live (needs you)

1. `npx supabase db push` (migration `20261009000100_pg_agreements.sql`).
2. No new environment variables.
