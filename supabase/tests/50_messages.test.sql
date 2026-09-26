-- Phase 5: message log and wording isolation.
begin;
select plan(12);

\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set staff_a  '''a0000000-0000-4000-8000-000000000002'''
\set admin_b  '''b0000000-0000-4000-8000-000000000001'''
\set order_a  '''a3000000-0000-4000-8000-000000000001'''
\set order_b  '''b3000000-0000-4000-8000-000000000001'''

select tests.act_as(:staff_a);
select lives_ok(
  format($$insert into public.message_log (rental_order_id, message_type, channel, to_number, body_snapshot, sent_by, opened_at)
    values (%L, 'BOOKING_CONFIRMATION', 'WHATSAPP', '9111111101', 'hello', %L, '2000-01-01')$$,
    'a3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  'staff can log a send for their own booking');
select results_eq(
  $$select sent_by, opened_at > now() - interval '1 minute' from public.message_log where body_snapshot = 'hello'$$,
  $$values ('a0000000-0000-4000-8000-000000000002'::uuid, true)$$,
  'sender and time come from the session, not the request');
select throws_ok(
  format($$insert into public.message_log (rental_order_id, message_type, channel, to_number, body_snapshot)
    values (%L, 'AMOUNT_DUE', 'SMS', '9111111201', 'x')$$, 'b3000000-0000-4000-8000-000000000001'),
  '23503', null, 'cannot log a message for another business''s booking');
select throws_ok(
  format($$insert into public.message_log (rental_order_id, message_type, channel, to_number, body_snapshot)
    values (%L, 'AMOUNT_DUE', 'COPY', '9111111101', 'x')$$, 'a3000000-0000-4000-8000-000000000001'),
  '23514', null, 'Copy entries have no recipient number');
select throws_ok($$update public.message_log set body_snapshot = 'edited'$$, '42501', null,
  'log entries cannot be edited');
select throws_ok($$delete from public.message_log$$, '42501', null, 'log entries cannot be deleted');
select throws_ok(
  $$insert into public.message_templates (message_type, body) values ('AMOUNT_DUE', 'staff wording')$$,
  '42501', null, 'staff cannot change message wording');

select tests.act_as(:admin_a);
select lives_ok(
  $$insert into public.message_templates (message_type, body) values ('AMOUNT_DUE', 'A wording {amount_due}')$$,
  'owner can set message wording');

select tests.act_as(:admin_b);
select is((select count(*)::int from public.message_log), 0, 'owner B sees none of A''s log');
select is((select count(*)::int from public.message_templates), 0, 'owner B sees none of A''s wording');
update public.message_templates set body = 'hacked';

reset role;
select is((select body from public.message_templates where message_type = 'AMOUNT_DUE'), 'A wording {amount_due}',
  'owner B could not change A''s wording');
select is((select tenant_id from public.message_templates where message_type = 'AMOUNT_DUE'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'wording belongs to tenant A');

select * from finish();
rollback;
