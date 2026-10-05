-- WhatsApp Cloud API: connections visible only to their business, tokens
-- only to service_role, delivery status only writable server-side.
begin;
select plan(14);

\set staff_a '''a0000000-0000-4000-8000-000000000002'''
\set admin_b '''b0000000-0000-4000-8000-000000000001'''
\set super   '''10000000-0000-4000-8000-000000000001'''
\set tenant_a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''

select tests.act_as(:staff_a);
select is((select count(*)::int from public.whatsapp_connections), 1, 'members see their own business''s connection');
select throws_ok(format($$select public.wa_access_token(%L)$$, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '42501', null, 'signed-in users cannot read an access token');
select throws_ok(format($$select public.wa_set_credentials(%L, 'x-new-token-value-123456789')$$, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '42501', null, 'signed-in users cannot set an access token');
select throws_ok($$update public.whatsapp_connections set status = 'DISCONNECTED'$$, '42501', null,
  'members cannot change the connection');
select throws_ok($$select * from private.whatsapp_credentials$$, '42501', null, 'members cannot see the credential table');

-- Members can't log (fake) API sends or change delivery status.
select throws_ok(
  $$insert into public.message_log (rental_order_id, message_type, channel, to_number, body_snapshot, template_name, provider_message_id, delivery_status)
    values ('a3000000-0000-4000-8000-000000000001', 'AMOUNT_DUE', 'WHATSAPP_API', '9111111101', 'hi', 'rentcorp_amount_due', 'wamid.FAKE', 'DELIVERED')$$,
  '42501', null, 'members cannot log a fake API send');
select throws_ok($$update public.message_log set delivery_status = 'READ'$$, '42501', null,
  'members cannot change delivery status');
-- The server (service role) logs a real API send for tenant A.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into public.message_log (tenant_id, rental_order_id, message_type, channel, to_number, body_snapshot, template_name, provider_message_id, delivery_status, sent_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'AMOUNT_DUE', 'WHATSAPP_API', '9111111101', 'hi', 'rentcorp_amount_due', 'wamid.TEST1', 'SENT', 'a0000000-0000-4000-8000-000000000002');
reset role;
select tests.act_as(:staff_a);

-- Consent timestamps.
select ok((select whatsapp_opt_in_at is not null from public.rental_customers where id = 'a2000000-0000-4000-8000-000000000001'),
  'seeded opt-in has a timestamp');
update public.rental_customers set whatsapp_opt_in = false where id = 'a2000000-0000-4000-8000-000000000001';
select ok((select whatsapp_opted_out_at is not null from public.rental_customers where id = 'a2000000-0000-4000-8000-000000000001'),
  'opting out records when');

select tests.act_as(:admin_b);
select is((select count(*)::int from public.whatsapp_connections), 0, 'another business sees no connection');
select is((select count(*)::int from public.message_log where provider_message_id = 'wamid.TEST1'), 0,
  'another business sees no API log rows');

select tests.act_as(:super);
select is((select count(*)::int from public.whatsapp_connections), 1, 'platform admin sees connections');

reset role;
set local role service_role;
select is(length(public.wa_access_token(:tenant_a)), 38, 'service_role can read the token');
select lives_ok(format($$select public.wa_set_credentials(%L, 'replacement-dummy-token-000000000')$$, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'service_role can replace the token');

select * from finish();
rollback;
