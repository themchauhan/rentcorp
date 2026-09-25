# Phase 10 — Security hardening and pilot readiness

This phase gates real customer data. Do not proceed to a real pilot
until every item below is checked.

## Tasks

- [ ] Review RLS and authorization for every table; write down the
      review, don't just eyeball it
- [ ] Systematically test cross-tenant access across every table and
      route
- [ ] Audit events exist for: booking create/edit, return, payment,
      user changes, subscription changes, every message send/copy
- [ ] Database backup/recovery procedure documented and tested (a
      real restore, not just a backup)
- [ ] Secure session settings reviewed (cookie flags, session length)
- [ ] Admin MFA confirmed working for all admin accounts before pilot
- [ ] Send on WhatsApp / Send SMS verified on the pilot's actual
      phones (Android and iOS if both are used)
- [ ] Data retention/deletion policy written
- [ ] Pilot runs with dummy data first; only after sign-off does a
      small controlled pilot with a real tent-house business begin

## Acceptance criteria

- Documented security test checklist passes
- Backups/recovery tested at least once
- Pilot can complete the real workflow without using real customer
  data prematurely
