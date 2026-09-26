-- Phase 2: item catalog isolation and permissions.
begin;
select plan(17);

\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set tenant_b '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''
\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set staff_a  '''a0000000-0000-4000-8000-000000000002'''
\set inactive_a '''a0000000-0000-4000-8000-000000000003'''
\set admin_b  '''b0000000-0000-4000-8000-000000000001'''
\set item_a1  '''a1000000-0000-4000-8000-000000000001'''
\set item_b1  '''b1000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------- staff A
select tests.act_as(:staff_a);
select is((select count(*)::int from public.rental_items), 8, 'staff A sees all 8 of tenant A''s items');
select is((select count(*)::int from public.rental_items where tenant_id = :tenant_b), 0,
  'staff A sees none of tenant B''s items');
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('Staff item', 'Other', 1, 100, 'PER_DAY')$$,
  '42501', null, 'staff cannot add items');
update public.rental_items set rate_paise = 1 where id = :item_a1;
select throws_ok($$delete from public.rental_items$$, '42501', null, 'DELETE is denied');

-- ---------------------------------------------------------------- admin A
select tests.act_as(:admin_a);
select lives_ok(
  format($$insert into public.rental_items (tenant_id, name, category, total_quantity_owned, rate_paise, rate_unit)
    values (%L, 'Forged item', 'Other', 5, 5000, 'PER_EVENT')$$, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'owner can add an item');
select is((select tenant_id from public.rental_items where name = 'Forged item'), :tenant_a::uuid,
  'a forged tenant_id is replaced with the owner''s own tenant');
select is((select created_by from public.rental_items where name = 'Forged item'), :admin_a::uuid,
  'created_by defaults to the signed-in owner');

update public.rental_items set rate_paise = 1 where id = :item_b1;
update public.rental_items set tenant_id = :tenant_b where id = :item_a1;
update public.rental_items set rate_paise = 1100 where id = :item_a1;

select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('  plastic CHAIR ', 'Furniture', 1, 100, 'PER_DAY')$$,
  '23505', null, 'duplicate item name (case/space-insensitive) is rejected');
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('Negative', 'Other', 1, -1, 'PER_DAY')$$,
  '23514', null, 'negative price is rejected');
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('Negative qty', 'Other', -1, 100, 'PER_DAY')$$,
  '23514', null, 'negative quantity is rejected');
select throws_ok(
  $$insert into public.rental_items (name, category, total_quantity_owned, rate_paise, rate_unit)
    values ('   ', 'Other', 1, 100, 'PER_DAY')$$,
  '23514', null, 'blank name is rejected');

-- ---------------------------------------------------------------- admin B
select tests.act_as(:admin_b);
select is((select count(*)::int from public.rental_items where tenant_id = :tenant_a), 0,
  'owner B sees none of tenant A''s items');
update public.rental_items set active = false where id = :item_a1;

-- ---------------------------------------------------------------- inactive / anon
select tests.act_as(:inactive_a);
select is((select count(*)::int from public.rental_items), 0, 'a deactivated user sees no items');
select tests.act_as_anon();
select throws_ok('select * from public.rental_items', '42501', null, 'anon cannot read items');

-- ---------------------------------------------------------------- verify as postgres
reset role;
select is((select rate_paise from public.rental_items where id = :item_b1), 1200::bigint,
  'owner A could not change tenant B''s price');
select results_eq(
  format('select tenant_id, rate_paise, active from public.rental_items where id = %L', 'a1000000-0000-4000-8000-000000000001'),
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 1100::bigint, true)$$,
  'staff edit ignored, owner edit applied, tenant_id frozen, owner B could not deactivate it');
select is((select count(*)::int from public.rental_items where name = 'Staff item'), 0, 'no staff item exists');

select * from finish();
rollback;
