# Tent House Rental SaaS — Claude Code project rules

Read at the start of every session. Follow it over any conflicting
instinct.

## What this project is

A multi-tenant, mobile-first web app (installable PWA) sold to
tent-house/event-rental businesses. Staff track rented-out items; the
app builds the itemized message with rates and amount due, and staff
send it from their own phone via WhatsApp or normal SMS with one tap.
The app never sends messages by itself — no messaging provider, no
automation. It is NOT inventory/warehouse software, NOT an accounting
system, and does not take online payments.

Full spec: `docs/BRIEF.md`. Phase checklists: `docs/phases/phase-N.md`
— read only the current phase's file plus `phase-0.md`.

## Hard rules

1. **One phase at a time.** Don't start a later phase's work early.
2. **Tenant identity is server-derived, never client-supplied.**
   `tenant_id` always comes from the authenticated session, never a
   browser-supplied value.
3. **RLS is mandatory on every tenant-owned table.**
4. **The Supabase service-role key never runs in browser-reachable
   code.** Confine it to one server-only module for platform-admin
   tasks; regular tenant reads/writes use the user's own session.
5. **Dummy data only in seeds/fixtures.** Never real customer names,
   phone numbers, or addresses.
6. **No hard deletes** on bookings, customers, or payment records —
   soft-delete only.
7. **No online payment integration.** Payments received are recorded
   manually (amount + mode + received-by).
8. **Rate snapshotting is mandatory.** An order's item rates are
   copied at booking time; later catalog rate changes never alter an
   existing booking's amount due. Amounts are always calculated by
   the app (never typed in), in integer paise. Booking-level
   discounts (flat ₹ or %) are audit-logged on every change.
9. **Every message send/copy tap is logged** (channel, number, exact
   body, amount due at that moment). The app cannot confirm delivery,
   so the UI never claims "Delivered" — only "Opened in WhatsApp/SMS".
   No automated or scheduled sending, and no WhatsApp Business API or
   SMS gateway integration.
10. **Mobile-first.** Every screen is designed and tested at ~360px
    phone width first, then desktop.
11. **Every feature ships with tests for the happy path and the
    cross-tenant failure path** before it's marked done.

## Definition of done (every phase)

- [ ] `npm run build` and `npm run lint` succeed
- [ ] Migrations apply cleanly to a fresh local Supabase instance
- [ ] Seed data loads and the feature is usable end to end
- [ ] Tests exist for: happy path, invalid input, cross-tenant access
      attempt
- [ ] Manual test steps are written in the phase file and have
      actually been run once
- [ ] Changed files, new env vars, and migrations are summarized at
      the end of the session
- [ ] No secrets appear in any client-bundle-reachable file

## Tech stack

Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS.
Supabase (Postgres, Auth, private Storage) via `@supabase/ssr` using
the user's session for all tenant data paths. Deploy on Vercel
(Mumbai/`bom1` region where available). Vitest + Playwright + SQL
tests for RLS. Customer messages go out via `wa.me` and `sms:` links
opened on the user's own phone — see `docs/BRIEF.md` for specifics.

## Working style

- Plan mode first for anything touching auth, RLS, the data model, or
  the amount-due calculation engine.
- One phase = one branch.
- When something in `docs/BRIEF.md` is ambiguous, ask rather than
  guess — a wrong assumption in the rate-calculation logic is
  expensive to unwind once real bookings exist.

@AGENTS.md
