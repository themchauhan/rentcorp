-- Deleting test businesses: super admin only, test-flagged only, exact
-- name, everything removed including logins, audit trail kept.
begin;
select plan(13);

\set super   '''10000000-0000-4000-8000-000000000001'''
\set admin_b '''b0000000-0000-4000-8000-000000000001'''
\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set tenant_b '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

-- Give tenant B a payment and a reversal so the delete order is exercised.
select tests.act_as('b0000000-0000-4000-8000-000000000002');
insert into public.rental_payments (rental_order_id, amount_paise, mode)
values ('b3000000-0000-4000-8000-000000000001', 1000, 'CASH');
select tests.act_as(:admin_b);
insert into public.rental_payments (rental_order_id, kind, amount_paise, mode, reverses_payment_id)
select rental_order_id, 'REVERSAL', -1000, 'CASH', id from public.rental_payments
where rental_order_id = 'b3000000-0000-4000-8000-000000000001';

-- ------------------------------------------------ refusals
select tests.act_as(:admin_b);
select throws_ok(format($$select public.delete_test_business(%L, 'Demo Tent House B')$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '42501', null, 'a business owner cannot delete a business');

select tests.act_as(:super);
select throws_ok(format($$select public.delete_test_business(%L, 'Demo Tent House B')$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '23514', null, 'a business not marked as Test cannot be deleted');

update public.tenants set is_test = true where id = :tenant_b;
select throws_ok(format($$select public.delete_test_business(%L, 'demo tent house b')$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '22023', null, 'the confirmation must match the name exactly');

select tests.act_as_anon();
select throws_ok(format($$select public.delete_test_business(%L, 'Demo Tent House B')$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '42501', null, 'anon cannot call it');

-- ------------------------------------------------ delete
select tests.act_as(:super);
select is(
  (select public.delete_test_business(:tenant_b, 'Demo Tent House B') ->> 'logins'),
  '2', 'deletes the test business and reports its 2 logins');

reset role;
select is((select count(*)::int from public.tenants where id = :tenant_b), 0, 'business is gone');
select is((select count(*)::int from public.profiles where tenant_id = :tenant_b), 0, 'its staff profiles are gone');
select is((select count(*)::int from auth.users where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')), 0,
  'its logins are gone (mobiles free to reuse)');
select is((select count(*)::int from public.rental_orders where tenant_id = :tenant_b), 0, 'its bookings are gone');
select is((select count(*)::int from public.rental_payments where tenant_id = :tenant_b), 0, 'its payments (and reversals) are gone');
select results_eq(
  $$select tenant_id, user_id, metadata ->> 'name' from public.audit_logs where action = 'tenant.test_deleted'$$,
  $$values (null::uuid, '10000000-0000-4000-8000-000000000001'::uuid, 'Demo Tent House B')$$,
  'a platform audit entry records who deleted what');
select is((select count(*)::int from public.rental_orders where tenant_id = :tenant_a), 1, 'other businesses are untouched');
select is((select count(*)::int from auth.users where id = '10000000-0000-4000-8000-000000000001'), 1, 'the super admin still exists');

select * from finish();
rollback;
