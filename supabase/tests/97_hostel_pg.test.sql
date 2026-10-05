-- Hostel / PG (phase 13): business-type isolation, rooms/beds, stays,
-- rate snapshots, dues mirror, payments, settlement, complaints, ID photos.
begin;
select plan(56);

\set super    '''10000000-0000-4000-8000-000000000001'''
\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set owner_d  '''d0000000-0000-4000-8000-000000000001'''
\set staff_d  '''d0000000-0000-4000-8000-000000000002'''
\set owner_e  '''e0000000-0000-4000-8000-000000000001'''
\set tenant_d '''dddddddd-dddd-4ddd-8ddd-dddddddddddd'''
\set tenant_e '''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'''
\set room_101 '''d1000000-0000-4000-8000-000000000001'''
\set room_202 '''d1000000-0000-4000-8000-000000000004'''
\set bed_101c '''d2000000-0000-4000-8000-000000000003'''
\set bed_102a '''d2000000-0000-4000-8000-000000000004'''
\set bed_102b '''d2000000-0000-4000-8000-000000000005'''
\set aarav    '''d4000000-0000-4000-8000-000000000001'''
\set kabir_stay '''d5000000-0000-4000-8000-000000000002'''
\set aarav_stay '''d5000000-0000-4000-8000-000000000001'''
\set rohan_stay '''d5000000-0000-4000-8000-000000000004'''

-- A customer of D with no stay, for move-ins.
reset role;
insert into public.rental_customers (id, tenant_id, name, mobile, preferred_channel)
values ('d4000000-0000-4000-8000-0000000000aa', :tenant_d, 'Demo Newcomer', '9111111499', 'SMS');

-- ------------------------------------------------ isolation
select tests.act_as(:owner_e);
select is((select count(*)::int from public.pg_rooms where tenant_id = :tenant_d), 0, 'PG E cannot see PG D rooms');
select is((select count(*)::int from public.pg_stays where tenant_id = :tenant_d), 0, 'PG E cannot see PG D stays');
select is((select count(*)::int from public.pg_payments where tenant_id = :tenant_d), 0, 'PG E cannot see PG D payments');
select is((select count(*)::int from public.pg_complaints where tenant_id = :tenant_d), 0, 'PG E cannot see PG D complaints');
select is((select count(*)::int from public.pg_resident_details where tenant_id = :tenant_d), 0, 'PG E cannot see PG D resident details');
with u as (update public.pg_rooms set rent_paise = 1 where id = :room_101 returning 1)
select is((select count(*)::int from u), 0, 'PG E cannot edit a PG D room');

select tests.act_as(:admin_a);
select is((select count(*)::int from public.pg_rooms), 0, 'a tent house sees no PG rooms');
select throws_ok($$insert into public.pg_rooms (name, rent_mode, rent_paise) values ('X', 'PER_BED', 100)$$,
  '42501', null, 'a tent house cannot create PG rooms');
select throws_ok($$select public.pg_create_room('X', null, 'PER_BED', 100, 2)$$,
  '42501', null, 'a tent house cannot use pg_create_room');
select throws_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0)$$,
  'd4000000-0000-4000-8000-0000000000aa', 'd2000000-0000-4000-8000-000000000003'),
  '42501', null, 'a tent house cannot move anyone in');

select tests.act_as(:staff_d);
select is((select count(*)::int from public.pg_rooms), 4, 'PG staff see their own rooms');
select throws_ok($$insert into public.pg_rooms (name, rent_mode, rent_paise) values ('X', 'PER_BED', 100)$$,
  '42501', null, 'PG staff cannot create rooms');
select throws_ok($$insert into public.pg_stays (tenant_id, customer_id, room_id, start_date) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-0000000000aa', 'd1000000-0000-4000-8000-000000000001', current_date)$$,
  '42501', null, 'stays cannot be written directly');

-- ------------------------------------------------ rooms
select tests.act_as(:owner_d);
select lives_ok($$select public.pg_create_room('301', 'Second', 'PER_BED', 550000, 3)$$, 'owner creates a room with beds');
select is((select count(*)::int from public.pg_beds b join public.pg_rooms r on r.id = b.room_id where r.name = '301'), 3,
  'the room gets 3 beds');
select throws_ok($$select public.pg_create_room('301', null, 'PER_BED', 1, 1)$$, '23505', null, 'room names are unique');

-- ------------------------------------------------ move-in
select tests.act_as(:staff_d);
select throws_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0, 1)$$,
  'd4000000-0000-4000-8000-0000000000aa', 'd2000000-0000-4000-8000-000000000003'),
  '42501', null, 'staff cannot set a different rent');
select throws_ok(format($$select public.pg_move_in(%L, %L, null, current_date, null, 0)$$,
  'd4000000-0000-4000-8000-0000000000aa', 'd1000000-0000-4000-8000-000000000004'),
  '23514', null, 'a room under maintenance takes no one');
select throws_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0)$$,
  'd4000000-0000-4000-8000-0000000000aa', 'd2000000-0000-4000-8000-000000000001'),
  '23505', null, 'an occupied bed cannot be taken');
select throws_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0)$$,
  'd4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000003'),
  '23505', null, 'someone already living here cannot move in twice');
select lives_ok(format($$select public.pg_move_in(%L, null, %L, current_date, %L, 500000)$$,
  'd4000000-0000-4000-8000-0000000000aa', 'd2000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000001'),
  'staff move a resident into a vacant bed');
select results_eq(
  $$select r.rent_paise, r.meal_paise, r.electricity_paise, r.meal_plan_name from public.pg_stay_rates r
    join public.pg_stays s on s.id = r.stay_id where s.bed_id = 'd2000000-0000-4000-8000-000000000003'$$,
  $$values (600000::bigint, 250000::bigint, 50000::bigint, 'Breakfast + Dinner'::text)$$,
  'rates are copied from the room, plan and settings');

select tests.act_as(:owner_e);
select throws_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0)$$,
  'e4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000005'),
  '23503', null, 'another PG cannot use this PG''s bed');

-- ------------------------------------------------ rate snapshots
select tests.act_as(:owner_d);
update public.pg_rooms set rent_paise = 999900 where id = :room_101;
select is((select rent_paise from public.pg_stay_rates where stay_id = :aarav_stay), 600000::bigint,
  'a later room price change does not alter an existing stay');
select throws_ok(format($$update public.pg_rooms set rent_mode = 'PER_ROOM' where id = %L$$, 'd1000000-0000-4000-8000-000000000001'),
  '23514', null, 'an occupied room cannot change rent type');
select throws_ok(format($$select public.pg_change_rates(%L, current_date, 1, null, 0)$$, 'd5000000-0000-4000-8000-000000000001'),
  '22023', null, 'new rates cannot start today or earlier');
select throws_ok(format($$select public.pg_change_rates(%L, current_date + 3, 1, null, 0)$$, 'd5000000-0000-4000-8000-000000000001'),
  '22023', null, 'new rates must start on a due date');
select lives_ok(format($$select public.pg_change_rates(%L, (select (start_date + interval '2 months')::date from public.pg_stays where id = %L), 700000, null, 50000)$$,
  'd5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001'),
  'owner sets new rates from a future due date');
select tests.act_as(:staff_d);
select throws_ok(format($$select public.pg_change_rates(%L, (select (start_date + interval '2 months')::date from public.pg_stays where id = %L), 1, null, 0)$$,
  'd5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001'),
  '42501', null, 'staff cannot change rates');

-- ------------------------------------------------ dues mirror (seed figures)
reset role;
select is(private.pg_stay_balance_paise(:kabir_stay, private.today_ist()), 1300000::bigint,
  'Kabir owes 2 months (3 × ₹6,500 − ₹6,500 paid)');
select is(private.pg_stay_balance_paise(:aarav_stay, private.today_ist()), 0::bigint, 'Aarav is paid up');
select is(private.pg_stay_deposit_held_paise(:aarav_stay), 1000000::bigint, 'deposit is held separately');

-- ------------------------------------------------ payments
select tests.act_as(:staff_d);
select lives_ok(format($$insert into public.pg_payments (stay_id, purpose, amount_paise, mode) values (%L, 'RENT', 650000, 'UPI')$$,
  'd5000000-0000-4000-8000-000000000002'), 'staff record a rent payment');
select is((select received_by from public.pg_payments where stay_id = :kabir_stay and amount_paise = 650000 and received_at > now() - interval '1 minute'),
  :staff_d::uuid, 'received-by is stamped from the session');
select throws_ok(format($$insert into public.pg_payments (stay_id, purpose, amount_paise, mode) values (%L, 'REFUND', 100, 'CASH')$$,
  'd5000000-0000-4000-8000-000000000002'), '42501', null, 'staff cannot record refunds');
select throws_ok(format($$insert into public.pg_payments (stay_id, purpose, kind, amount_paise, mode, reverses_payment_id) values (%L, 'RENT', 'REVERSAL', -650000, 'UPI', 'd6000000-0000-4000-8000-000000000005')$$,
  'd5000000-0000-4000-8000-000000000002'), '42501', null, 'staff cannot reverse payments');
select tests.act_as(:owner_d);
select lives_ok(format($$insert into public.pg_payments (stay_id, purpose, kind, amount_paise, mode, reverses_payment_id) values (%L, 'RENT', 'REVERSAL', -650000, 'OTHER', 'd6000000-0000-4000-8000-000000000005')$$,
  'd5000000-0000-4000-8000-000000000002'), 'owner reverses a payment');
select throws_ok(format($$insert into public.pg_payments (stay_id, purpose, kind, amount_paise, mode, reverses_payment_id) values (%L, 'RENT', 'REVERSAL', -650000, 'OTHER', 'd6000000-0000-4000-8000-000000000005')$$,
  'd5000000-0000-4000-8000-000000000002'), '23505', null, 'a payment can be reversed only once');
select tests.act_as(:owner_e);
select throws_ok(format($$insert into public.pg_payments (stay_id, purpose, amount_paise, mode) values (%L, 'RENT', 100, 'CASH')$$,
  'd5000000-0000-4000-8000-000000000002'), '23503', null, 'another PG cannot record payments on this stay');

-- ------------------------------------------------ notice, settlement, cancel
select tests.act_as(:staff_d);
select lives_ok(format($$select public.pg_give_notice(%L, current_date, current_date + 30)$$, 'd5000000-0000-4000-8000-000000000001'),
  'staff record notice');
select lives_ok(format($$select public.pg_withdraw_notice(%L)$$, 'd5000000-0000-4000-8000-000000000001'), 'notice can be withdrawn');
select throws_ok(format($$select public.pg_settle_move_out(%L, current_date)$$, 'd5000000-0000-4000-8000-000000000004'),
  '42501', null, 'staff cannot settle a move-out');
select tests.act_as(:owner_d);
select throws_ok(format($$select public.pg_cancel_stay(%L)$$, 'd5000000-0000-4000-8000-000000000004'),
  '23514', null, 'a stay with payments cannot be cancelled');
select is(
  public.pg_settle_move_out(:rohan_stay, private.today_ist(), '[{"amount_paise": 200000, "reason": "Broken chair"}]'),
  -800000::bigint, 'settlement: paid up, ₹2,000 deducted from ₹10,000 deposit → refund ₹8,000');
select is((select status::text from public.pg_stays where id = :rohan_stay), 'MOVED_OUT', 'the stay is closed');
select lives_ok(format($$select public.pg_move_in(%L, null, %L, current_date, null, 0)$$,
  'd4000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000005'),
  'a moved-out resident''s next stay can start; the old bed is vacant');

-- ------------------------------------------------ messages
select tests.act_as(:staff_d);
select lives_ok(format($$insert into public.message_log (pg_stay_id, message_type, channel, to_number, body_snapshot) values (%L, 'RENT_DUE', 'WHATSAPP', '9111111402', 'Rent due')$$,
  'd5000000-0000-4000-8000-000000000002'), 'resident messages are logged against the stay');
select throws_ok($$insert into public.message_log (message_type, channel, body_snapshot) values ('RENT_DUE', 'COPY', 'x')$$,
  '23514', null, 'a message log row needs a booking or a stay');

-- ------------------------------------------------ complaints
select lives_ok(format($$insert into public.pg_complaints (stay_id, category, description) values (%L, 'FOOD', 'Dinner was cold')$$,
  'd5000000-0000-4000-8000-000000000002'), 'staff log a complaint for a resident');
select is((select room_id from public.pg_complaints where description = 'Dinner was cold'), :room_101::uuid,
  'the room is filled in from the stay');
update public.pg_complaints set status = 'RESOLVED' where description = 'Dinner was cold';
select is((select resolved_by from public.pg_complaints where description = 'Dinner was cold'), :staff_d::uuid,
  'who resolved it is stamped');

-- ------------------------------------------------ ID photos
select throws_ok(format($$insert into public.pg_id_documents (customer_id, doc_type, storage_path, content_type, size_bytes) values (%L, 'AADHAAR', %L, 'image/jpeg', 10)$$,
  'd4000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/x/y.jpg'),
  '23514', null, 'an ID photo must live in this business''s folder');
insert into public.pg_id_documents (customer_id, doc_type, side, storage_path, content_type, size_bytes)
select 'd4000000-0000-4000-8000-000000000003', 'AADHAAR', 'FRONT',
       'dddddddd-dddd-4ddd-8ddd-dddddddddddd/d4000000-0000-4000-8000-000000000003/' || g || '.jpg', 'image/jpeg', 1000
from generate_series(1, 4) g;
select throws_ok(format($$insert into public.pg_id_documents (customer_id, doc_type, storage_path, content_type, size_bytes) values (%L, 'PAN', %L, 'image/jpeg', 10)$$,
  'd4000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd/d4000000-0000-4000-8000-000000000003/5.jpg'),
  '23514', null, 'at most 4 ID photos are kept per resident');
reset role;
insert into storage.objects (bucket_id, name) values ('resident-ids', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd/d4000000-0000-4000-8000-000000000001/a.jpg');
select tests.act_as(:owner_e);
select is((select count(*)::int from storage.objects where bucket_id = 'resident-ids'), 0, 'another PG cannot see the ID photo file');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('resident-ids', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd/x/b.jpg')$$,
  '42501', null, 'another PG cannot upload into this PG''s folder');

-- ------------------------------------------------ business type is fixed
select tests.act_as(:super);
select throws_ok(format($$update public.tenants set business_type = 'TENT_HOUSE' where id = %L$$, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  '23514', null, 'a business''s type can never change');

select * from finish();
rollback;
