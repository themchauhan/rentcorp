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
| message_log | members | manual sends: members, writable, sender/time forced; API sends: server only (trigger blocks users) | delivery status: webhook only (service role) | 50, 95 |
| subscription_payments | super admin | super admin | none | 80 |
| whatsapp_connections | own business; super admin | server only (super admin, or the owner for their own business — tenant from the session) | server only | 95, e2e |
| whatsapp_settings | own business | owner, writable business | owner, writable business | 96 |
| job_runs | super admin | server only | server only | 96 |
| private.whatsapp_credentials | not exposed; tokens in Vault, read only via `wa_access_token()` (service_role) | `wa_set_credentials()` (service_role) | — | 95 |
| private.booking_counters | not exposed | trigger only | trigger only | 40 |

SECURITY DEFINER functions and their own checks: `cancel_booking`
(writable + owner + same tenant + no returns), `close_booking` (writable +
same tenant + all returned + `final_balance_paise ≤ 0`),
`provision_tenant_with_owner` (service_role only), `mark_password_changed`
(own row only), `delete_test_business` (platform admin + business marked
`is_test` + exact-name confirmation; the only hard delete, all-or-nothing,
leaves a platform audit entry) [`85_test_business_delete`]. `create_booking` and `record_returns` run as the caller
(RLS applies).

## WhatsApp webhook

`/api/whatsapp/webhook` is public but every POST must carry a valid
`X-Hub-Signature-256` (HMAC of the raw body with the Meta app secret).
Updates are matched to a business by `phone_number_id` and only touch that
business's rows; statuses only move forward [e2e `whatsapp-api.spec.ts`].

## Scheduled job

`/api/cron/evening-reminders` (Vercel Cron, 21:00 IST) is public but
requires `Authorization: Bearer <CRON_SECRET>` (constant-time compare).
It uses the secret key because it spans businesses, but every query and
send is filtered to the business being processed; read-only businesses and
businesses with the reminder off are skipped. A unique index on
`message_log (rental_order_id, reminder_date)` makes a second reminder the
same day impossible, even if the job is retried [`96`, e2e].

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
