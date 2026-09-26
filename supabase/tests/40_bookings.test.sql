-- Phase 3: customers, bookings, rate snapshotting, cross-tenant references.
begin;
select plan(24);

\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set tenant_b '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''
\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set staff_a  '''a0000000-0000-4000-8000-000000000002'''
\set inactive_a '''a0000000-0000-4000-8000-000000000003'''
\set staff_b  '''b0000000-0000-4000-8000-000000000002'''
\set cust_a   '''a2000000-0000-4000-8000-000000000001'''
\set cust_b   '''b2000000-0000-4000-8000-000000000001'''
\set chair_a  '''a1000000-0000-4000-8000-000000000001'''
\set stage_a_inactive '''a1000000-0000-4000-8000-000000000008'''
\set chair_b  '''b1000000-0000-4000-8000-000000000001'''

-- ------------------------------------------------ seed snapshot sanity
select results_eq(
  $$select item_name_snapshot, rate_paise_snapshot, rate_unit_snapshot::text
    from public.rental_order_items
    where rental_order_id = 'a3000000-0000-4000-8000-000000000001' order by item_name_snapshot$$,
  $$values ('Plastic chair', 1000::bigint, 'PER_DAY'), ('Shamiana 20x20 ft', 150000::bigint, 'PER_EVENT')$$,
  'seed line placeholders were replaced by catalog snapshots');
select is((select booking_number from public.rental_orders where id = 'a3000000-0000-4000-8000-000000000001'), 1,
  'first booking of a business is #1');
select is((select booking_number from public.rental_orders where id = 'b3000000-0000-4000-8000-000000000001'), 1,
  'booking numbers are per business');

-- ------------------------------------------------ staff A creates a booking
select tests.act_as(:staff_a);

select lives_ok(
  format($$select public.create_booking(%L, current_date, current_date + 1,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 20}]'::jsonb,
    p_discount_type => 'PERCENT', p_discount_value => 1000, p_discount_reason => 'regular')$$,
    'a2000000-0000-4000-8000-000000000001'),
  'staff can create a booking');
select is((select booking_number from public.rental_orders where discount_reason = 'regular'), 2,
  'second booking of tenant A is #2');
select results_eq(
  $$select tenant_id, created_by, discount_updated_by from public.rental_orders where discount_reason = 'regular'$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid,
            'a0000000-0000-4000-8000-000000000002'::uuid)$$,
  'tenant, creator and discount author come from the session');

-- Direct insert with forged snapshot values: trigger overwrites them.
insert into public.rental_order_items (rental_order_id, rental_item_id, quantity,
  item_name_snapshot, unit_label_snapshot, rate_paise_snapshot, rate_unit_snapshot)
select id, 'a1000000-0000-4000-8000-000000000002', 2, 'Forged', 'x', 1, 'PER_EVENT'
from public.rental_orders where discount_reason = 'regular';
select results_eq(
  $$select item_name_snapshot, rate_paise_snapshot, rate_unit_snapshot::text from public.rental_order_items
    where rental_item_id = 'a1000000-0000-4000-8000-000000000002'$$,
  $$values ('Round table', 15000::bigint, 'PER_DAY')$$,
  'client-supplied rate snapshot is replaced by the catalog rate');

-- Cross-tenant references are impossible.
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 1}]'::jsonb)$$,
    'b2000000-0000-4000-8000-000000000001'),
  '23503', null, 'booking with another business''s customer is rejected');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date,
    '[{"item_id": "b1000000-0000-4000-8000-000000000001", "quantity": 1}]'::jsonb)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '23503', null, 'booking with another business''s item is rejected');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date,
    '[{"item_id": "a1000000-0000-4000-8000-000000000008", "quantity": 1}]'::jsonb)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '23514', null, 'a deactivated item cannot be booked');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date - 1,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 1}]'::jsonb)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '23514', null, 'return date before start date is rejected');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date, '[]'::jsonb)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '22023', null, 'a booking needs at least one item');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 0}]'::jsonb)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '23514', null, 'quantity must be at least 1');
select throws_ok(
  format($$select public.create_booking(%L, current_date, current_date,
    '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 1}]'::jsonb,
    p_discount_type => 'PERCENT', p_discount_value => 10001)$$,
    'a2000000-0000-4000-8000-000000000001'),
  '23514', null, 'a discount over 100% is rejected');

select is((select count(*)::int from public.rental_orders where tenant_id = :tenant_b), 0,
  'staff A sees no tenant B bookings');
select is((select count(*)::int from public.rental_customers where tenant_id = :tenant_b), 0,
  'staff A sees no tenant B customers');
select is((select count(*)::int from public.item_commitments(current_date, current_date + 5)
  where rental_item_id = :chair_b), 0, 'availability never counts tenant B bookings');
select is((select committed from public.item_commitments(current_date, current_date)
  where rental_item_id = :chair_a), 120, 'chairs committed today = 100 (seed) + 20 (new)');

select throws_ok($$update public.rental_orders set status = 'CANCELLED'$$, '42501', null,
  'bookings cannot be edited directly');
select throws_ok($$update public.rental_order_items set rate_paise_snapshot = 1$$, '42501', null,
  'booking lines (and their snapshots) cannot be edited');
select throws_ok($$delete from public.rental_orders$$, '42501', null, 'bookings cannot be deleted');
select throws_ok($$delete from public.rental_customers$$, '42501', null, 'customers cannot be deleted');

-- ------------------------------------------------ catalog price change later
select tests.act_as(:admin_a);
update public.rental_items set rate_paise = 99900 where id = :chair_a;
select is((select rate_paise_snapshot from public.rental_order_items
  where rental_order_id = 'a3000000-0000-4000-8000-000000000001' and rental_item_id = :chair_a), 1000::bigint,
  'a later catalog price change does not alter an existing booking');

-- ------------------------------------------------ inactive user
select tests.act_as(:inactive_a);
select is((select count(*)::int from public.rental_orders), 0, 'a deactivated user sees no bookings');

select * from finish();
rollback;
