# Phase 1c — Super admin provisioning, staff accounts

Login is mobile number + password with no email/SMS (see phase-1b.md),
so new accounts get an app-generated **temporary password**, shown once
to whoever created the account, and must choose their own password on
first login.

**2FA/MFA is deferred** (decided 2026-09-26) — tracked in phase-10.md
as a decision to make before the pilot.

## Tasks

- [x] Secure one-time way to provision the first SUPER_ADMIN
      (`scripts/create-super-admin.mjs`, secret key, run manually —
      never a public signup route)
- [x] SUPER_ADMIN creates a business and its first ADMIN (owner mobile
      → temporary password), atomically (`provision_tenant_with_owner`)
- [x] ADMIN can add STAFF (name, mobile → temporary password), scoped to
      their own tenant_id server-side — no email invites
- [x] ADMIN can reset a staff member's password; SUPER_ADMIN can reset
      an owner's password (no self-service reset)
- [x] Forced password change on first login / after a reset
      (`profiles.must_change_password`, `/change-password`)
- [x] Staff account deactivate/reactivate (soft: status + Auth ban, not
      delete)
- [x] Secret key confined to `src/lib/supabase/admin.ts` (server-only)
      and the CLI script

## Tests

- [x] A staff account created by an admin gets that admin's tenant_id,
      never a client-supplied one (forged `tenant_id` e2e test)
- [x] An owner can't deactivate/reset another business's staff
      (tampered profile id e2e test)
- [x] A deactivated account cannot log in
- [x] A temporary password can't skip the forced change
- [x] `mark_password_changed()` only clears the caller's flag; signed-in
      users can't run provisioning (`supabase/tests/20_accounts.test.sql`)
- [x] Invalid input: empty name, bad mobile, duplicate mobile

## Acceptance criteria

- A brand-new tenant business can be provisioned end-to-end:
  SUPER_ADMIN creates the tenant and its admin, that admin logs in and
  adds a staff member (`e2e/accounts.spec.ts` "onboarding")

## Manual test steps

1. `npm run db:reset`
2. Create a super admin:
   `node --env-file=.env.local scripts/create-super-admin.mjs --mobile 9000000009 --name "Test Admin"`
   (enter a password twice) — or use seed `9000000001` / `Demo@1234`
3. Log in as the super admin → Businesses → New business → note the
   owner's temporary password
4. Log out, log in as the owner with the temporary password → forced
   to "Choose your own password" → save → Home shows the new business
5. More → Team → Add staff → note the temporary password
6. Log out, log in as the staff member → choose own password → Home
7. As the owner: Team → Deactivate the staff member → their login is
   refused; Reactivate → works again; Reset password → new temporary
   password works and forces a change
