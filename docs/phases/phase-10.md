# Phase 10 — Security hardening and pilot readiness

This phase gates real customer data. Do not proceed to a real pilot
until every item below is checked.

## Tasks

- [x] Review RLS and authorization for every table; write down the
      review, don't just eyeball it (`docs/security/rls-review.md`;
      schema-wide invariants auto-tested in `90_security_sweep`)
- [x] Systematically test cross-tenant access across every table and
      route (pgTAP 10–90; `e2e/security.spec.ts` sweeps tenant-A URLs as
      tenant B and uses a real tenant-B token directly against every table)
- [x] Audit events exist for: booking create/edit, return, payment,
      user changes, subscription changes, every message send/copy
      (`e2e/audit.spec.ts` checks the money/message ones end to end)
- [~] Database backup/recovery procedure documented and tested (a
      real restore, not just a backup) — local restore tested
      (`npm run db:backup-test`); **hosted restore drill still needs
      you** (`docs/operations/backup-restore.md`)
- [x] Secure session settings reviewed (cookie flags, session length) —
      httpOnly/Lax/Secure cookies, security headers
      (`docs/security/session-settings.md`); hosted inactivity timeout is
      a decision for you
- [ ] Decide on 2FA/MFA for owners and super admin (deferred from
      Phase 1c); if adopted, confirm it works for all admin accounts
- [ ] Send on WhatsApp / Send SMS verified on the pilot's actual
      phones (Android and iOS if both are used)
- [~] Data retention/deletion policy written — draft in
      `docs/policies/data-retention.md`, **needs your sign-off**
- [ ] Pilot runs with dummy data first; only after sign-off does a
      small controlled pilot with a real tent-house business begin

## Acceptance criteria

- Documented security test checklist passes
- Backups/recovery tested at least once
- Pilot can complete the real workflow without using real customer
  data prematurely
