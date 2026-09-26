# Phase 9 — Super admin dashboard and manual subscriptions

Read-only mode: a business that is SUSPENDED, EXPIRED, or past its
trial/subscription end can still log in and view everything, but every
change is blocked — in the app (`requireActiveTenant()` for writes,
`requireTenantMember()` for reads, banner in the app shell) **and in the
database** (every tenant write policy uses
`private.current_writable_tenant_id()`, migration `…0900`). Nothing is
deleted; reactivating restores full access with all data.

Subscription end dates are stored as the end of that IST day. Plans are
free-text labels (TRIAL / MONTHLY / YEARLY suggested); pricing isn't
modelled.

## Tasks

- [x] Super Admin dashboard: tenant counts/statuses, tenant list
- [x] Create/activate/suspend a tenant, change plan, change expiry,
      manually extend subscription
- [x] `subscription_payments` table — record offline UPI/bank
      payments manually (no gateway integration)
- [x] Confirm `requireActiveTenant()` is enforced on every protected
      route/action, not just the dashboard (every server action and
      write page uses it; read pages use `requireTenantMember()`; the
      message-log API checks access; DB policies enforce it regardless)
- [x] Expired/suspended tenants get a restricted/read-only state —
      data preserved, never deleted
- [x] Audit log entries for every subscription state change

## Tests

- [x] Only SUPER_ADMIN can change subscription state (tested at the
      server/RLS level — `supabase/tests/80_subscriptions.test.sql`)
- [x] Expiry enforced server-side even if the client is bypassed
- [x] Expired/suspended tenant data is intact once reactivated

## Acceptance criteria

- Only SUPER_ADMIN can change subscription state; expiry is enforced
  server-side; no tenant data is deleted due to expiry

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000001` (super admin)
2. Businesses: count tiles; Demo Tent House C shows Suspended
3. Log in as `9000000301` (Owner C): amber "This account is suspended"
   banner, data visible, no New booking / Add item; /bookings/new
   sends you Home
4. As super admin open Demo Tent House C → Record a subscription payment
   (₹999, UPI, reference) with "Extend…" ticked → "Has access"
5. Owner C now has full access; data unchanged
6. Try +1 month / +1 year, and change status/plan/dates in the form;
   every change appears in the audit log (`audit_logs`, tenant C)
