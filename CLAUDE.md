# RentCorp SaaS — Claude Code project rules

Read at the start of every session. Follow it over any conflicting
instinct.

## What this project is

A multi-tenant, mobile-first web app (installable PWA) sold to
tent-house/event-rental businesses and (since phase 13) hostels/PGs. Each
business has a fixed **business type** (`TENT_HOUSE` | `HOSTEL_PG`) that
decides its menus; a page or action for one type 404s for the other. Staff track rented-out items; the
app builds the itemized message with rates and amount due, and staff
send it from their own phone via WhatsApp or normal SMS with one tap.
Businesses can also connect their own WhatsApp Business number so the
app sends approved WhatsApp templates for them (Meta Cloud API). It is NOT inventory/warehouse software, NOT an accounting
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
   soft-delete only. Sole exception: the super admin may permanently
   delete a business **marked as Test** (typed-name confirmation,
   `public.delete_test_business()`), for test data only.
7. **No online payment integration.** Payments received are recorded
   manually (amount + mode + received-by).
8. **Rate snapshotting is mandatory.** An order's item rates are
   copied at booking time; later catalog rate changes never alter an
   existing booking's amount due. Amounts are always calculated by
   the app (never typed in), in integer paise. Booking-level
   discounts (flat ₹ or %) are audit-logged on every change.
   Hostel/PG: rent, meal plan and electricity are snapshotted per stay
   (`pg_stay_rates`); a change applies only from a future due date. Dues
   come from `src/lib/pg-dues.ts`, mirrored in SQL.
9. **Every message is logged.** Manual sends (Send on WhatsApp / Send
   SMS / Copy) log channel, number, exact body and amount due; the app
   can't confirm their delivery, so the UI says only "Opened in
   WhatsApp/SMS". Automatic WhatsApp sends go only through **each
   business's own** WhatsApp Business number via Meta's Cloud API, only
   to customers who **agreed** to receive them, using Meta-approved
   templates; they are logged by the server with Meta's real delivery
   status (sent/delivered/read/failed). Access tokens live in Supabase
   Vault and never reach the browser. Automation is an **optional add-on**
   (`tenants.whatsapp_addon`, switched only by the super admin); without it a
   business sees only the one-tap buttons, no WhatsApp settings or consent box. Automatic sends: booking details
   on save, and one balance message per booking per evening (9 PM IST)
   while money is due — each switchable per business, never twice a day
   (database-enforced). No SMS gateway. Businesses without WhatsApp
   connected keep the one-tap manual buttons.
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
