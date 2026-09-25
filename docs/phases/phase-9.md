# Phase 9 — Super admin dashboard and manual subscriptions

## Tasks

- [ ] Super Admin dashboard: tenant counts/statuses, tenant list
- [ ] Create/activate/suspend a tenant, change plan, change expiry,
      manually extend subscription
- [ ] `subscription_payments` table — record offline UPI/bank
      payments manually (no gateway integration)
- [ ] Confirm `requireActiveTenant()` is enforced on every protected
      route/action, not just the dashboard
- [ ] Expired/suspended tenants get a restricted/read-only state —
      data preserved, never deleted
- [ ] Audit log entries for every subscription state change

## Tests

- [ ] Only SUPER_ADMIN can change subscription state (tested at the
      server/RLS level)
- [ ] Expiry enforced server-side even if the client is bypassed
- [ ] Expired/suspended tenant data is intact once reactivated

## Acceptance criteria

- Only SUPER_ADMIN can change subscription state; expiry is enforced
  server-side; no tenant data is deleted due to expiry
