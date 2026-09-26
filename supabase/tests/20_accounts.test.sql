-- Phase 1c: temporary-password flag and provisioning function.
begin;
select plan(7);

\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set admin_a '''a0000000-0000-4000-8000-000000000001'''

-- Flag both users as needing a password change.
update public.profiles set must_change_password = true where id in (:staff_a, :admin_a);

select tests.act_as(:staff_a);
select lives_ok($$select public.mark_password_changed()$$, 'a user can clear their own flag');

-- A user cannot flip the flag (or anything else) directly.
update public.profiles set must_change_password = true where id = :staff_a;
update public.profiles set must_change_password = false where id = :admin_a;

select throws_ok(
  $$select public.provision_tenant_with_owner('Rogue', gen_random_uuid(), 'X', '9111111112')$$,
  '42501', null, 'signed-in users cannot run tenant provisioning');

select tests.act_as_anon();
select throws_ok($$select public.mark_password_changed()$$, '42501', null,
  'anon cannot call mark_password_changed');

reset role;
select is((select must_change_password from public.profiles where id = :staff_a), false,
  'mark_password_changed cleared the caller''s flag, and direct UPDATE could not set it back');
select is((select must_change_password from public.profiles where id = :admin_a), true,
  'another user''s flag is untouched');

-- Provisioning is all-or-nothing (run as postgres, like service_role).
select throws_ok(
  $$select public.provision_tenant_with_owner('Half Made',
      'a0000000-0000-4000-8000-000000000001', 'Dup Owner', '9111111113')$$,
  '23505', null, 'provisioning is atomic: a duplicate owner id fails the whole call');
select is((select count(*)::int from public.tenants where name = 'Half Made'), 0,
  'no orphan tenant is left behind when provisioning fails');

select * from finish();
rollback;
