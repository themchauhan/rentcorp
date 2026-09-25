# Phase 1b — Auth, roles, RLS, tenant guard, audit foundation

Highest-risk phase. Use plan mode before writing migrations.

## Tasks

- [ ] Migrations: `tenants`, `profiles`, `audit_logs`
- [ ] Supabase Auth wired up: login, logout, password reset
- [ ] `profiles.role` enum: SUPER_ADMIN, ADMIN, STAFF
- [ ] Server-side `getSessionProfile()` helper — the ONLY place
      `tenant_id` and `role` are read from, always from the session,
      never a client-supplied value
- [ ] `requireRole(...)` and `requireActiveTenant()` guards used on
      every protected route/action
- [ ] RLS policies on `tenants`, `profiles`, `audit_logs`
- [ ] `platform_admins` check for SUPER_ADMIN — not a nullable
      `tenant_id` trick
- [ ] Audit log helper: `logAudit(action, targetType, targetId, meta)`
- [ ] Seed script with dummy tenant businesses, dummy staff logins
- [ ] `tenants.status`, `plan`, `trial_ends_at`,
      `subscription_ends_at` columns exist even though enforcement UI
      comes in Phase 9

## Tests

- [ ] Happy path: each role can log in and reach its own routes
- [ ] Cross-tenant: a user from Tenant A cannot read or write a row
      belonging to Tenant B, tested at the DB level
- [ ] A forged `tenant_id` in a request payload is rejected/ignored
      server-side
- [ ] No service-role key or DB credentials in any client bundle

## Acceptance criteria

- Users can sign in/out; role-protected routes work; tenants cannot
  see each other's data (verified by test); no secrets in client
  bundles
