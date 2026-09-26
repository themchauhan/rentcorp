# Phase 1b — Auth, roles, RLS, tenant guard, audit foundation

Highest-risk phase. Use plan mode before writing migrations.

Login is **mobile number + password** (decided 2026-09-26). Supabase
Auth has no SMS-free phone+password flow, so each mobile maps to an
internal email `91<mobile>@mobile.invalid` (see `src/lib/auth/mobile.ts`).
There is no public signup and no self-service "forgot password":
accounts and password resets are handled by admins (Phase 1c).

## Tasks

- [x] Migrations: `tenants`, `profiles`, `platform_admins`, `audit_logs`
- [x] Supabase Auth wired up: login (mobile + password), logout,
      change own password (admin-initiated reset comes in Phase 1c)
- [x] `app_role` enum: SUPER_ADMIN, ADMIN, STAFF (`profiles.role` is
      ADMIN/STAFF; SUPER_ADMIN comes from `platform_admins`)
- [x] Server-side `getSessionProfile()` helper — the ONLY place
      `tenant_id` and `role` are read from, always from the session,
      never a client-supplied value
- [x] `requireRole(...)` and `requireActiveTenant()` guards used on
      every protected route/action
- [x] RLS policies on `tenants`, `profiles`, `platform_admins`,
      `audit_logs`; no DELETE possible on any of them
- [x] `platform_admins` check for SUPER_ADMIN — not a nullable
      `tenant_id` trick
- [x] Reusable `private.force_tenant_id()` trigger: tenant_id on insert
      always comes from the session (later tenant tables reuse it)
- [x] Audit log helper: `logAudit(action, targetType, targetId, meta)`
- [x] Seed script with dummy tenant businesses, dummy staff logins
- [x] `tenants.status`, `plan`, `trial_ends_at`,
      `subscription_ends_at` columns exist even though enforcement UI
      comes in Phase 9

## Tests

- [x] Happy path: each role can log in and reach its own routes
      (`e2e/auth.spec.ts`)
- [x] Cross-tenant: a user from Tenant A cannot read or write a row
      belonging to Tenant B, tested at the DB level
      (`supabase/tests/10_tenant_isolation.test.sql`)
- [x] A forged `tenant_id` in a request payload is rejected/ignored
      server-side (forged audit insert is rewritten to the caller's
      tenant — same test file)
- [x] Invalid input: bad mobile, wrong password, wrong current password
- [x] No service-role key or DB credentials in any client bundle
      (`scripts/check-client-bundle.mjs`, runs in CI)

## Acceptance criteria

- Users can sign in/out; role-protected routes work; tenants cannot
  see each other's data (verified by test); no secrets in client
  bundles

## Manual test steps

Seed logins are listed in `supabase/seed.sql` (password `Demo@1234`).

1. `npm run db:start`, `npm run db:reset`, `npm run dev`
2. At phone width, open http://localhost:3000 → redirected to /login
3. Log in as `9000000102` (Staff A): Home shows "Demo Tent House A";
   More has no "Business settings"; visiting /settings or /admin →
   "You don't have access"
4. Log out; log in as `9000000101` (Admin A): More → Business settings
   opens
5. Log in as `9000000201` (Admin B): only "Demo Tent House B" appears
6. Log in as `9000000001` (Super admin): lands on Platform dashboard
7. Log in as `9000000103` (inactive): "account has been deactivated"
8. Log in as `9000000301` (suspended tenant): "account is suspended"
9. More → Change password: wrong current password is rejected; a
   valid change works and the old password stops working
