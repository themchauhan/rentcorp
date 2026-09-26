-- Cross-tenant isolation for tenants, profiles, platform_admins, audit_logs.
-- Uses seed users (see supabase/seed.sql).
begin;
select plan(33);

-- Seed ids
\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set tenant_b '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''
\set super    '''10000000-0000-4000-8000-000000000001'''
\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set staff_a  '''a0000000-0000-4000-8000-000000000002'''
\set inactive_a '''a0000000-0000-4000-8000-000000000003'''
\set admin_b  '''b0000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------- staff A
select tests.act_as(:staff_a);

select results_eq('select id from public.tenants', array[:tenant_a::uuid],
  'staff A sees only tenant A');
select is((select count(*)::int from public.profiles where tenant_id = :tenant_b), 0,
  'staff A sees no tenant B profiles');
select is((select count(*)::int from public.profiles), 4,
  'staff A sees the 4 tenant A profiles (incl. inactive colleague)');
select is((select count(*)::int from public.audit_logs), 0,
  'STAFF cannot read audit logs, even their own tenant''s');
select is((select count(*)::int from public.platform_admins), 0,
  'staff A cannot see platform admins');

-- Writes across tenants are impossible.
update public.tenants set name = 'hacked' where id = :tenant_b;
update public.tenants set name = 'hacked' where id = :tenant_a;
update public.profiles set name = 'hacked' where tenant_id = :tenant_b;
update public.profiles set role = 'ADMIN' where id = :staff_a;

select throws_ok(
  $$insert into public.tenants (name) values ('Rogue tenant')$$,
  '42501', null, 'staff cannot create tenants');
select throws_ok(
  format('insert into public.profiles (id, tenant_id, name, mobile, role) values (%L, %L, %L, %L, %L)',
    gen_random_uuid(), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Rogue', '9111111111', 'ADMIN'),
  '42501', null, 'staff cannot create profiles (any tenant)');
select throws_ok($$delete from public.tenants$$, '42501', null, 'DELETE on tenants is denied');
select throws_ok($$delete from public.profiles$$, '42501', null, 'DELETE on profiles is denied');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'DELETE on audit_logs is denied');
select throws_ok($$update public.audit_logs set action = 'x'$$, '42501', null,
  'audit logs cannot be edited');
select throws_ok(
  format('insert into public.platform_admins (user_id, name) values (%L, %L)',
    'a0000000-0000-4000-8000-000000000002', 'me'),
  '42501', null, 'staff cannot make themselves a platform admin');

-- Forged tenant_id / user_id in an audit insert are overwritten from the session.
insert into public.audit_logs (tenant_id, user_id, action)
values (:tenant_b, :admin_b, 'test.forged');

-- ---------------------------------------------------------------- verify as postgres
reset role;
select is((select name from public.tenants where id = :tenant_b), 'Demo Tent House B',
  'tenant B name unchanged by staff A');
select is((select name from public.tenants where id = :tenant_a), 'Demo Tent House A',
  'staff cannot rename their own tenant');
select is((select count(*)::int from public.profiles where name = 'hacked'), 0,
  'no profile renamed across tenants');
select is((select role::text from public.profiles where id = :staff_a), 'STAFF',
  'staff cannot promote themselves to ADMIN');
select results_eq(
  $$select tenant_id, user_id from public.audit_logs where action = 'test.forged'$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid)$$,
  'forged tenant_id and user_id replaced with staff A''s own');

-- ---------------------------------------------------------------- admin A
select tests.act_as(:admin_a);
select is((select count(*)::int from public.audit_logs where tenant_id = :tenant_b), 0,
  'admin A sees no tenant B audit logs');
select ok((select count(*) from public.audit_logs) >= 1 and
  (select bool_and(tenant_id = :tenant_a) from public.audit_logs),
  'admin A sees only tenant A audit logs');
select results_eq('select id from public.tenants', array[:tenant_a::uuid],
  'admin A sees only tenant A');
select is((select count(*)::int from public.profiles where tenant_id = :tenant_b), 0,
  'admin A sees no tenant B profiles');

-- ---------------------------------------------------------------- admin B (mirror)
select tests.act_as(:admin_b);
select results_eq('select id from public.tenants', array[:tenant_b::uuid],
  'admin B sees only tenant B');
select is((select count(*)::int from public.profiles where tenant_id = :tenant_a), 0,
  'admin B sees no tenant A profiles');
select is((select count(*)::int from public.audit_logs where tenant_id = :tenant_a), 0,
  'admin B sees no tenant A audit logs');

-- ---------------------------------------------------------------- inactive user
select tests.act_as(:inactive_a);
select is((select count(*)::int from public.tenants), 0, 'inactive user sees no tenant');
select results_eq('select id from public.profiles', array[:inactive_a::uuid],
  'inactive user sees only their own profile');
select throws_ok($$insert into public.audit_logs (action) values ('test.inactive')$$,
  '42501', null, 'inactive user cannot write audit logs');

-- ---------------------------------------------------------------- anon
select tests.act_as_anon();
select throws_ok('select * from public.tenants', '42501', null, 'anon cannot read tenants');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.audit_logs', '42501', null, 'anon cannot read audit logs');

-- ---------------------------------------------------------------- platform admin
select tests.act_as(:super);
select is((select count(*)::int from public.tenants), 3, 'platform admin sees all tenants');
select is((select count(*)::int from public.profiles), 7, 'platform admin sees all profiles');
select ok((select count(distinct tenant_id) from public.audit_logs) >= 2,
  'platform admin sees audit logs of every tenant');

select * from finish();
rollback;
