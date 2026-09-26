# Security review — RLS and authorization (Phase 10)

Reviewed 2026-09-26 against migrations `…0100` → `…0900`. Every claim
below is backed by an automated test (named in brackets).

## Model

- **Identity**: Supabase Auth session (httpOnly cookie). `auth.uid()` is
  the only identity the database trusts.
- **Tenant**: `private.current_tenant_id()` — the caller's tenant, only if
  their profile is ACTIVE. `private.current_writable_tenant_id()` — the
  same, only if the business currently has access (not suspended /
  expired / past its end date). Neither ever comes from a request.
- **Role**: `private.current_app_role()` — SUPER_ADMIN (platform_admins),
  else the ACTIVE profile's role.
- **tenant_id on writes**: defaults to the session tenant and is
  overwritten by `private.force_tenant_id()`; composite foreign keys
  `(tenant_id, id)` make cross-business references impossible.
- **Secret key**: only `src/lib/supabase/admin.ts` (server-only) and the
  CLI script; used for account administration after session guards.

## Schema-wide invariants [`90_security_sweep`]

- Every `public` table has RLS enabled and at least one policy.
- `anon` has no table privileges and can't execute any public function
  or use the `private` schema.
- `authenticated` has no DELETE/TRUNCATE on any table (soft-delete only).
- Every SECURITY DEFINER function pins `search_path`.

## Table by table

| Table | Read | Insert | Update | Tests |
|---|---|---|---|---|
| tenants | own tenant; super admin all | super admin | super admin only (status, plan, dates) | 10, 80 |
| profiles | own row; same tenant; super admin | server only (secret key after owner/super-admin guard) | super admin; own flag via `mark_password_changed()` | 10, 20 |
| platform_admins | own row | CLI only | none | 10 |
| audit_logs | tenant ADMIN (own); super admin | any member, actor/tenant forced by trigger | none (append-only) | 10, e2e audit |
| rental_items | members | owner, writable tenant | owner, writable tenant | 30, 80 |
| rental_customers | members | members, writable | members, writable | 40, 80 |
| rental_orders | members | members via `create_booking()`, writable | discount columns only, open bookings, writable; status only via definer functions | 40, 70, 80 |
| rental_order_items | members | members, writable; rates snapshotted by trigger | none (immutable) | 40 |
| rental_returns | members | members, writable; quantity/date checked, row-locked | none | 70 |
| rental_payments | members | members, writable; reversals owner-only | none | 70, 80 |
| message_templates | members | owner, writable | owner, writable | 50 |
| message_log | members | members, writable; sender/time forced | none | 50 |
| subscription_payments | super admin | super admin | none | 80 |
| private.booking_counters | not exposed | trigger only | trigger only | 40 |

SECURITY DEFINER functions and their own checks: `cancel_booking`
(writable + owner + same tenant + no returns), `close_booking` (writable +
same tenant + all returned + `final_balance_paise ≤ 0`),
`provision_tenant_with_owner` (service_role only), `mark_password_changed`
(own row only). `create_booking` and `record_returns` run as the caller
(RLS applies).

## App layer

- Every server action calls a guard: `requireActiveTenant()` (writes),
  `requireTenantAdmin()` (owner writes), `requireRole("SUPER_ADMIN")`
  (platform). Read pages use `requireTenantMember()`.
- Objects are always loaded through the user's session first (RLS), so a
  tampered id from another business is "not found" [e2e: items,
  bookings, accounts, returns, messages, security].
- `/api/message-log` checks the session and derives recipient and amount
  from the database.
- Direct database access with a real tenant-B token cannot read or write
  tenant A [e2e `security.spec.ts` "bypassing the app"].

## Session and transport

See [session-settings.md](session-settings.md).

## Findings

None open. Earlier issues fixed during the build: login mis-reporting
rate limits as wrong password (1b); send-panel log race (5); sections
hiding result messages after refresh (7).
