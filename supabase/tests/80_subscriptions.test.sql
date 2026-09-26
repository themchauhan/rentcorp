-- Phase 9: subscription state is super-admin only; expired/suspended
-- businesses are read-only in the database; data survives and works again
-- after reactivation.
begin;
select plan(16);

\set super   '''10000000-0000-4000-8000-000000000001'''
\set admin_a '''a0000000-0000-4000-8000-000000000001'''
\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set admin_c '''c0000000-0000-4000-8000-000000000001'''
\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set tenant_c '''cccccccc-cccc-4ccc-8ccc-cccccccccccc'''

-- ------------------------------------------------ only the super admin changes subscriptions
select tests.act_as(:admin_a);
update public.tenants set status = 'ACTIVE', subscription_ends_at = now() + interval '10 years' where id = :tenant_a;
select throws_ok(
  format($$insert into public.subscription_payments (tenant_id, amount_paise, payment_date, payment_method, period_start, period_end)
    values (%L, 100000, current_date, 'UPI', current_date, current_date + 30)$$, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '42501', null, 'an owner cannot record a subscription payment');
select is((select count(*)::int from public.subscription_payments), 0, 'owners cannot read subscription payments');
reset role;
select ok((select subscription_ends_at < now() + interval '5 years' from public.tenants where id = :tenant_a),
  'an owner cannot extend their own subscription');

-- ------------------------------------------------ suspended business C is read-only
select tests.act_as(:admin_c);
select is((select count(*)::int from public.tenants), 1, 'suspended owner can still read their business');
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('New item', 'Other', 1, 100, 'PER_DAY')$$,
  '42501', null, 'suspended business cannot add items');
select throws_ok(
  $$insert into public.rental_customers (name, mobile) values ('New', '9111111999')$$,
  '42501', null, 'suspended business cannot add customers');

-- ------------------------------------------------ suspend A: data stays readable, writes stop
select tests.act_as(:super);
update public.tenants set status = 'SUSPENDED' where id = :tenant_a;
select is((select status::text from public.tenants where id = :tenant_a), 'SUSPENDED', 'super admin suspends a business');

select tests.act_as(:staff_a);
select is((select count(*)::int from public.rental_items), 8, 'suspended business still sees all its items');
select is((select count(*)::int from public.rental_orders), 1, 'and its bookings');
select throws_ok(
  $$select public.create_booking('a2000000-0000-4000-8000-000000000001', current_date, current_date,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 1}]'::jsonb)$$,
  '42501', null, 'suspended business cannot create bookings');
select throws_ok(
  $$insert into public.rental_payments (rental_order_id, amount_paise, mode)
    values ('a3000000-0000-4000-8000-000000000001', 100, 'CASH')$$,
  '42501', null, 'suspended business cannot record payments');
update public.rental_customers set name = 'changed' where id = 'a2000000-0000-4000-8000-000000000001';

-- ------------------------------------------------ expired subscription behaves the same
select tests.act_as(:super);
update public.tenants set status = 'ACTIVE', subscription_ends_at = now() - interval '1 day' where id = :tenant_a;
select tests.act_as(:admin_a);
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('After expiry', 'Other', 1, 100, 'PER_DAY')$$,
  '42501', null, 'expired subscription is enforced by the database');

-- ------------------------------------------------ reactivate: everything works again
select tests.act_as(:super);
select lives_ok(
  format($$insert into public.subscription_payments (tenant_id, amount_paise, payment_date, payment_method, reference_number, period_start, period_end)
    values (%L, 99900, current_date, 'UPI', 'UPI-REF-1', current_date, current_date + 30)$$, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'super admin records a subscription payment');
update public.tenants set status = 'ACTIVE', subscription_ends_at = now() + interval '30 days' where id = :tenant_a;

select tests.act_as(:admin_a);
select lives_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('After renewal', 'Other', 1, 100, 'PER_DAY')$$,
  'after renewal the business can write again');

reset role;
select is((select name from public.rental_customers where id = 'a2000000-0000-4000-8000-000000000001'), 'Demo Customer Ravi',
  'the edit attempted while suspended did not apply');
select is((select recorded_by from public.subscription_payments where reference_number = 'UPI-REF-1'), :super::uuid,
  'subscription payment records the super admin');

select * from finish();
rollback;
