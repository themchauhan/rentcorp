-- WhatsApp automation: settings permissions, once-a-day guard, job runs.
begin;
select plan(10);

\set admin_a '''a0000000-0000-4000-8000-000000000001'''
\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set admin_b '''b0000000-0000-4000-8000-000000000001'''
\set admin_c '''c0000000-0000-4000-8000-000000000001'''
\set super   '''10000000-0000-4000-8000-000000000001'''

select tests.act_as(:staff_a);
select throws_ok($$insert into public.whatsapp_settings (evening_reminder) values (false)$$, '42501', null,
  'staff cannot change automation settings');

select tests.act_as(:admin_a);
update public.tenants set whatsapp_addon = false;
reset role;
select is((select whatsapp_addon from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true,
  'an owner cannot switch the WhatsApp add-on');
select tests.act_as(:admin_a);
select lives_ok($$insert into public.whatsapp_settings (evening_reminder) values (false)$$, 'owner can save settings');
select is((select tenant_id from public.whatsapp_settings), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'settings belong to the owner''s business');

select tests.act_as(:admin_b);
select is((select count(*)::int from public.whatsapp_settings), 0, 'another business can''t see them');
update public.whatsapp_settings set evening_reminder = true;

select tests.act_as(:admin_c); -- suspended business: read-only
select throws_ok($$insert into public.whatsapp_settings (evening_reminder) values (false)$$, '42501', null,
  'a read-only business cannot change settings');

reset role;
select is((select evening_reminder from public.whatsapp_settings where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false, 'owner B''s update did not touch A''s settings');

-- Once per booking per day for the evening reminder (server role).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into public.message_log (tenant_id, rental_order_id, message_type, channel, to_number, body_snapshot, delivery_status, reminder_date, sent_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'AMOUNT_DUE', 'WHATSAPP_API', '9111111101', 'x', 'PENDING', current_date, null);
select throws_ok(
  $$insert into public.message_log (tenant_id, rental_order_id, message_type, channel, to_number, body_snapshot, delivery_status, reminder_date)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'AMOUNT_DUE', 'WHATSAPP_API', '9111111101', 'y', 'PENDING', current_date)$$,
  '23505', null, 'a second evening reminder for the same booking and day is refused');

insert into public.job_runs (job, run_date) values ('evening_reminders', current_date);
reset role;
select tests.act_as(:admin_a);
select is((select count(*)::int from public.job_runs), 0, 'owners cannot see job runs');
select tests.act_as(:super);
select is((select count(*)::int from public.job_runs), 1, 'the super admin can');

select * from finish();
rollback;
