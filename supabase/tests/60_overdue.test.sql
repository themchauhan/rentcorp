-- Phase 6: overdue bookings keep their items committed.
begin;
select plan(3);

\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set sofa_a  '''a1000000-0000-4000-8000-000000000007'''

select tests.act_as(:staff_a);
-- A booking that should have come back 3 days ago (still open = overdue).
select public.create_booking(
  'a2000000-0000-4000-8000-000000000002', current_date - 6, current_date - 3,
  '[{"item_id": "a1000000-0000-4000-8000-000000000007", "quantity": 4}]'::jsonb);

select is((select committed from public.item_commitments(current_date, current_date) where rental_item_id = :sofa_a),
  4, 'an overdue booking still holds its items today');
select is((select committed from public.item_commitments(current_date + 5, current_date + 7) where rental_item_id = :sofa_a),
  null, 'but not on future dates (assumed back by then)');
select is((select count(*)::int from public.item_commitments(current_date - 20, current_date - 10) where rental_item_id = :sofa_a),
  0, 'and not before it started');

select * from finish();
rollback;
