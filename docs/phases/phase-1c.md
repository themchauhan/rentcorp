# Phase 1c — Super admin provisioning, staff accounts, MFA

## Tasks

- [ ] Secure one-time way to provision the first SUPER_ADMIN (a CLI
      script using the service-role key, run manually — never a
      public signup route)
- [ ] SUPER_ADMIN creates a tenant and its first ADMIN (mobile +
      temporary password)
- [ ] ADMIN can add STAFF (name, mobile, temporary password), scoped to
      their own tenant_id server-side — no email invites (login is by
      mobile number; see phase-1b.md)
- [ ] ADMIN can reset a staff member's password; SUPER_ADMIN can reset
      an ADMIN's password (there is no self-service reset)
- [ ] Prompt to change a temporary password on first login
- [ ] Staff account activate/deactivate (soft, not delete)
- [ ] TOTP-based MFA enabled for SUPER_ADMIN and ADMIN (authenticator
      app; revisit whether owners are comfortable with this)

## Tests

- [ ] A staff account created by an admin gets that admin's tenant_id,
      never a client-supplied one
- [ ] A deactivated account cannot log in
- [ ] MFA enforced on next login for the roles above

## Acceptance criteria

- A brand-new tenant business can be provisioned end-to-end:
  SUPER_ADMIN creates the tenant and its admin, that admin logs in and
  adds a staff member
