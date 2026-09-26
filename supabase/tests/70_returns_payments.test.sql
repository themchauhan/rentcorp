-- Phase 7: returns, payments, discount changes, close and cancel.
begin;
select plan(30);

\set admin_a '''a0000000-0000-4000-8000-000000000001'''
\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set admin_b '''b0000000-0000-4000-8000-000000000001'''
\set staff_b '''b0000000-0000-4000-8000-000000000002'''

-- ------------------------------------------------ setup (staff A)
select tests.act_as(:staff_a);
-- Started 3 days ago, due back today: 10 chairs ₹10/day + 1 shamiana ₹1,500/event.
create temp table t_order as
select public.create_booking(
  'a2000000-0000-4000-8000-000000000002', current_date - 3, current_date,
  '[{"item_id": "a1000000-0000-4000-8000-000000000001", "quantity": 10},
    {"item_id": "a1000000-0000-4000-8000-000000000003", "quantity": 1}]'::jsonb) as id;
grant select on t_order to authenticated;
create temp view t_lines as
  select li.id, li.item_name_snapshot as name from public.rental_order_items li
  where li.rental_order_id = (select id from t_order);
grant select on t_lines to authenticated;

-- ------------------------------------------------ returns
select lives_ok(
  format($$select public.record_returns(%L, current_date - 2, %L::jsonb, 'two scratched')$$,
    (select id from t_order),
    json_build_array(json_build_object('line_id', (select id from t_lines where name = 'Plastic chair'), 'quantity', 4))),
  'staff records a partial return (4 chairs, backdated)');
select is((select status::text from public.rental_orders where id = (select id from t_order)), 'PARTIALLY_RETURNED',
  'status becomes PARTIALLY_RETURNED');
select is((select recorded_by from public.rental_returns where condition_notes = 'two scratched'), :staff_a::uuid,
  'recorded_by comes from the session');

select throws_ok(
  format($$select public.record_returns(%L, current_date, %L::jsonb)$$, (select id from t_order),
    json_build_array(json_build_object('line_id', (select id from t_lines where name = 'Plastic chair'), 'quantity', 7))),
  '23514', null, 'cannot return more than is still out');
select throws_ok(
  format($$select public.record_returns(%L, current_date + 1, %L::jsonb)$$, (select id from t_order),
    json_build_array(json_build_object('line_id', (select id from t_lines where name = 'Plastic chair'), 'quantity', 1))),
  '23514', null, 'return date cannot be in the future');
select throws_ok(
  format($$select public.record_returns(%L, current_date - 4, %L::jsonb)$$, (select id from t_order),
    json_build_array(json_build_object('line_id', (select id from t_lines where name = 'Plastic chair'), 'quantity', 1))),
  '23514', null, 'return date cannot be before the start');

select lives_ok(
  format($$select public.record_returns(%L, current_date, %L::jsonb)$$, (select id from t_order),
    json_build_array(
      json_build_object('line_id', (select id from t_lines where name = 'Plastic chair'), 'quantity', 6),
      json_build_object('line_id', (select id from t_lines where name = 'Shamiana 20x20 ft'), 'quantity', 1))),
  'the rest comes back today');
select is((select status::text from public.rental_orders where id = (select id from t_order)), 'RETURNED',
  'status becomes RETURNED when everything is back');

-- 4 chairs × ₹10 × 2 days + 6 × ₹10 × 4 days + ₹1,500 = ₹80 + ₹240 + ₹1,500
reset role;
select is(private.final_balance_paise((select id from t_order)), 182000::bigint,
  'final bill matches the hand-computed amount (same case as the TS engine test)');

-- ------------------------------------------------ close needs settlement
select tests.act_as(:staff_a);
select throws_ok(format('select public.close_booking(%L)', (select id from t_order)),
  '23514', null, 'cannot close while money is owed');

select lives_ok(
  format($$insert into public.rental_payments (rental_order_id, amount_paise, mode, received_by, received_at)
    values (%L, 100000, 'UPI', %L, '2000-01-01')$$, (select id from t_order), 'b0000000-0000-4000-8000-000000000001'),
  'staff records a payment');
select results_eq(
  format('select received_by, received_at > now() - interval ''1 minute'' from public.rental_payments where rental_order_id = %L', (select id from t_order)),
  $$values ('a0000000-0000-4000-8000-000000000002'::uuid, true)$$,
  'received_by and time come from the session');
select throws_ok(
  format($$insert into public.rental_payments (rental_order_id, amount_paise, mode) values (%L, 0, 'CASH')$$, (select id from t_order)),
  '23514', null, 'zero payments are rejected');
select throws_ok(
  format($$insert into public.rental_payments (rental_order_id, kind, amount_paise, mode, reverses_payment_id)
    select %L, 'REVERSAL', -100000, 'UPI', id from public.rental_payments where rental_order_id = %L$$,
    (select id from t_order), (select id from t_order)),
  '42501', null, 'staff cannot reverse a payment');
select throws_ok($$update public.rental_payments set amount_paise = 1$$, '42501', null, 'payments cannot be edited');
select throws_ok($$delete from public.rental_payments$$, '42501', null, 'payments cannot be deleted');
select throws_ok($$delete from public.rental_returns$$, '42501', null, 'returns cannot be deleted');
select throws_ok(format($$update public.rental_orders set status = 'RETURNED' where id = %L$$, (select id from t_order)),
  '42501', null, 'status cannot be changed directly');

-- Discount at settlement: 10% of ₹1,820 = ₹182 → owes ₹1,638 − ₹1,000 = ₹638.
update public.rental_orders set discount_type = 'PERCENT', discount_value = 1000, discount_reason = 'settled'
where id = (select id from t_order);
reset role;
select results_eq(
  format('select discount_updated_by, private.final_balance_paise(id) from public.rental_orders where id = %L', (select id from t_order)),
  $$values ('a0000000-0000-4000-8000-000000000002'::uuid, 63800::bigint)$$,
  'staff discount applies and is stamped with who set it');

-- ------------------------------------------------ cross-tenant
select tests.act_as(:staff_b);
select throws_ok(
  format($$insert into public.rental_payments (rental_order_id, amount_paise, mode) values (%L, 100, 'CASH')$$, (select id from t_order)),
  '23503', null, 'another business cannot add a payment to this booking');
select throws_ok(
  format($$select public.record_returns(%L, current_date, '[]'::jsonb)$$, (select id from t_order)),
  '23503', null, 'another business cannot record returns on this booking');
select throws_ok(format('select public.close_booking(%L)', (select id from t_order)),
  '23503', null, 'another business cannot close this booking');

-- ------------------------------------------------ owner reversal and close
select tests.act_as(:admin_a);
select throws_ok(
  format($$insert into public.rental_payments (rental_order_id, kind, amount_paise, mode, reverses_payment_id)
    select %L, 'REVERSAL', -100001, 'CASH', id from public.rental_payments where rental_order_id = %L$$,
    (select id from t_order), (select id from t_order)),
  '23514', null, 'a reversal cannot exceed the payment');

select tests.act_as(:staff_a);
insert into public.rental_payments (rental_order_id, amount_paise, mode) select id, 63800, 'CASH' from t_order;
select lives_ok(format('select public.close_booking(%L)', (select id from t_order)), 'settled booking closes');
select throws_ok(
  format($$insert into public.rental_payments (rental_order_id, amount_paise, mode) values (%L, 100, 'CASH')$$, (select id from t_order)),
  '23514', null, 'no payments after closing');
-- Closed bookings are outside the update policy: the change matches no rows.
update public.rental_orders set discount_value = 0, discount_type = 'NONE' where id = (select id from t_order);
select is((select discount_value from public.rental_orders where id = (select id from t_order)), 1000::bigint,
  'discount is locked after closing');

-- ------------------------------------------------ cancel
create temp table t_cancel as
select public.create_booking('a2000000-0000-4000-8000-000000000002', current_date, current_date,
  '[{"item_id": "a1000000-0000-4000-8000-000000000002", "quantity": 1}]'::jsonb) as id;
grant select on t_cancel to authenticated;
select throws_ok(format($$select public.cancel_booking(%L, 'oops')$$, (select id from t_cancel)),
  '42501', null, 'staff cannot cancel');
select tests.act_as(:admin_b);
select throws_ok(format($$select public.cancel_booking(%L, 'oops')$$, (select id from t_cancel)),
  '23503', null, 'another business''s owner cannot even find it to cancel');
select tests.act_as(:admin_a);
select lives_ok(format($$select public.cancel_booking(%L, 'Booked by mistake')$$, (select id from t_cancel)),
  'owner cancels with a reason');
select throws_ok(format($$select public.cancel_booking(%L, 'again')$$, (select id from t_order)),
  '23514', null, 'a booking with returns cannot be cancelled');

select * from finish();
rollback;
