# Phase 1c — Super admin provisioning, staff invites, MFA

## Tasks

- [ ] Secure one-time way to provision the first SUPER_ADMIN (a CLI
      script using the service-role key, run manually — never a
      public signup route)
- [ ] ADMIN can invite STAFF via email invite, scoped to their own
      tenant_id server-side
- [ ] Staff account activate/deactivate (soft, not delete)
- [ ] TOTP-based MFA enabled for SUPER_ADMIN and ADMIN

## Tests

- [ ] An invited staff account gets the inviting admin's tenant_id,
      never a client-supplied one
- [ ] A deactivated account cannot log in
- [ ] MFA enforced on next login for the roles above

## Acceptance criteria

- A brand-new tenant business can be provisioned end-to-end:
  SUPER_ADMIN creates the tenant, an admin is invited, that admin logs
  in and invites a staff member
