# Data retention and deletion policy — DRAFT for owner sign-off

Status: **draft, needs your decision** before the pilot.

## What we store

Business account (name, phone), staff logins (name, mobile), customers
(name, mobile, WhatsApp number, address), bookings, returns, payments,
message log (full text of messages opened), audit log, subscription
payments.

## Proposed rules

1. **While a business is a customer**: keep everything. Nothing is ever
   deleted by the app (soft-delete / deactivate only).
2. **Expired or suspended**: data stays, read-only, for **12 months**
   after access ends, so the business can renew or export.
3. **After 12 months without renewal**, or on the business's written
   request: export their data (CSV) for them, then permanently delete the
   business and all its rows (a manual super-admin procedure with a
   second person checking). Backups roll off within the backup window
   (e.g. 30 days).
4. **A customer of a tent house asks to be removed**: the tent house (the
   data controller for its customers) decides; we can anonymise that
   customer's name, mobile and address on request, keeping the booking
   and payment amounts for the business's records.
5. **Audit and message logs** follow the business's retention (rule 2–3).
6. **Staff who leave**: deactivated, not deleted, so history still shows
   who did what.

## Needs your decision

- Retention period after access ends (12 months proposed).
- Whether businesses get a self-service data export before deletion.
- Who is the second person for permanent deletions.
- Terms of service / privacy notice wording for tent-house owners
  (legal review recommended; India's DPDP Act applies to personal data of
  customers).
