-- Phase 14: rent agreements & renewals.
begin;
select plan(31);

\set super    '''10000000-0000-4000-8000-000000000001'''
\set admin_a  '''a0000000-0000-4000-8000-000000000001'''
\set owner_d  '''d0000000-0000-4000-8000-000000000001'''
\set staff_d  '''d0000000-0000-4000-8000-000000000002'''
\set owner_e  '''e0000000-0000-4000-8000-000000000001'''
\set tenant_d '''dddddddd-dddd-4ddd-8ddd-dddddddddddd'''
\set tenant_e '''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'''
\set kabir_agr '''d8000000-0000-4000-8000-000000000002'''
\set meera_agr '''d8000000-0000-4000-8000-000000000003'''
\set kabir_stay '''d5000000-0000-4000-8000-000000000002'''
\set meera_stay '''d5000000-0000-4000-8000-000000000003'''
\set rohan_stay '''d5000000-0000-4000-8000-000000000004'''

-- ------------------------------------------------ isolation
select tests.act_as(:owner_e);
select is((select count(*)::int from public.pg_agreements where tenant_id = :tenant_d), 0,
  'another PG cannot see this PG''s agreements');
select throws_ok(format($$select public.pg_create_agreement(%L, current_date, 11)$$, 'd5000000-0000-4000-8000-000000000004'),
  '23503', null, 'another PG cannot add an agreement to this PG''s resident');
select throws_ok(format($$select public.pg_renew_agreement(%L, 11)$$, 'd8000000-0000-4000-8000-000000000002'),
  '23503', null, 'another PG cannot renew this PG''s agreement');

select tests.act_as(:admin_a);
select is((select count(*)::int from public.pg_agreements), 0, 'a tent house sees no agreements');
select throws_ok(format($$select public.pg_create_agreement(%L, current_date, 11)$$, 'd5000000-0000-4000-8000-000000000004'),
  '42501', null, 'a tent house cannot add agreements');

select tests.act_as(:owner_d);
select throws_ok($$insert into public.pg_agreements (tenant_id, stay_id, start_date, end_date) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000004', current_date, current_date)$$,
  '42501', null, 'agreements cannot be inserted directly');
select throws_ok(format($$update public.pg_agreements set end_date = end_date + 1 where id = %L$$, 'd8000000-0000-4000-8000-000000000002'),
  '42501', null, 'agreements cannot be edited directly');

-- ------------------------------------------------ create (staff)
select tests.act_as(:staff_d);
select throws_ok(format($$select public.pg_create_agreement(%L, current_date, 0)$$, 'd5000000-0000-4000-8000-000000000004'),
  '22023', null, 'an agreement needs at least 1 month');
select throws_ok(format($$select public.pg_create_agreement(%L, current_date, 6, 7)$$, 'd5000000-0000-4000-8000-000000000004'),
  '22023', null, 'lock-in cannot be longer than the agreement');
select lives_ok(format($$select public.pg_create_agreement(%L, '2026-01-31', 11, 6, 5)$$, 'd5000000-0000-4000-8000-000000000004'),
  'staff add an agreement');
select results_eq(
  format($$select end_date, lock_in_until from public.pg_agreements where stay_id = %L and status = 'ACTIVE'$$, 'd5000000-0000-4000-8000-000000000004'),
  $$values ('2026-12-30'::date, '2026-07-30'::date)$$,
  'end = start + 11 months − 1 day; lock-in likewise');
select throws_ok(format($$select public.pg_create_agreement(%L, current_date, 11)$$, 'd5000000-0000-4000-8000-000000000004'),
  '23505', null, 'only one current agreement per resident');

-- ------------------------------------------------ owner-only changes
select throws_ok(format($$select public.pg_update_agreement(%L, current_date + 400, null, 5)$$, 'd8000000-0000-4000-8000-000000000002'),
  '42501', null, 'staff cannot change an agreement');
select throws_ok(format($$select public.pg_renew_agreement(%L, 11, 630000)$$, 'd8000000-0000-4000-8000-000000000002'),
  '42501', null, 'staff cannot renew');
select throws_ok(format($$select public.pg_set_agreement_document(%L, %L, 'application/pdf', 10)$$,
  'd8000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd/d4000000-0000-4000-8000-000000000002/agreements/a.pdf'),
  '42501', null, 'staff cannot attach the agreement file');

select tests.act_as(:owner_d);
select throws_ok(format($$select public.pg_update_agreement(%L, '2000-01-01', null, 5)$$, 'd8000000-0000-4000-8000-000000000002'),
  '22023', null, 'end date cannot be before the start');
select lives_ok(format($$select public.pg_update_agreement(%L, current_date + 20, null, 5)$$, 'd8000000-0000-4000-8000-000000000002'),
  'owner edits the agreement');

-- ------------------------------------------------ renew
select lives_ok(format($$select public.pg_renew_agreement(%L, 11, 630000)$$, 'd8000000-0000-4000-8000-000000000002'),
  'owner renews with a 5% higher rent');
select is((select status::text from public.pg_agreements where id = :kabir_agr), 'RENEWED', 'the old term is marked renewed');
select results_eq(
  format($$select start_date, end_date, renewed_from from public.pg_agreements where stay_id = %L and status = 'ACTIVE'$$, 'd5000000-0000-4000-8000-000000000002'),
  format($$values (private.today_ist() + 21, ((private.today_ist() + 21) + interval '11 months')::date - 1, %L::uuid)$$, 'd8000000-0000-4000-8000-000000000002'),
  'the new term starts the day after the old one ends');
select ok(
  (select effective_from >= private.today_ist() + 21 and effective_from > private.today_ist()
     and exists (select 1 from generate_series(1, 1200) k
                 where (s.start_date + make_interval(months => k))::date = r.effective_from)
   from public.pg_stay_rates r join public.pg_stays s on s.id = r.stay_id
   where r.stay_id = :kabir_stay and r.rent_paise = 630000),
  'the new rent starts on a future due date inside the new term');
select is((select electricity_paise from public.pg_stay_rates where stay_id = :kabir_stay and rent_paise = 630000),
  50000::bigint, 'meal plan and electricity carry over');
select throws_ok(format($$select public.pg_renew_agreement(%L, 11)$$, 'd8000000-0000-4000-8000-000000000002'),
  '23514', null, 'a renewed term cannot be renewed again');

-- Late renewal: Meera's agreement ended 5 days ago; new rent from her next due date.
select lives_ok(format($$select public.pg_renew_agreement(%L, 11, 1500000)$$, 'd8000000-0000-4000-8000-000000000003'),
  'an expired agreement can still be renewed');
select is(
  (select effective_from from public.pg_stay_rates where stay_id = :meera_stay and rent_paise = 1500000),
  (select (start_date + interval '2 months')::date from public.pg_stays where id = :meera_stay),
  'a late renewal''s new rent waits for the next due date (never today or earlier)');

-- ------------------------------------------------ document
select throws_ok(format($$select public.pg_set_agreement_document(%L, %L, 'application/pdf', 10)$$,
  (select id from public.pg_agreements where stay_id = 'd5000000-0000-4000-8000-000000000002' and status = 'ACTIVE'),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/x/agreements/a.pdf'),
  '23514', null, 'the agreement file must be in this resident''s folder');
select is(
  public.pg_set_agreement_document(
    (select id from public.pg_agreements where stay_id = :kabir_stay and status = 'ACTIVE'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd/d4000000-0000-4000-8000-000000000002/agreements/a.pdf',
    'application/pdf', 10),
  null::text, 'owner attaches the agreement (nothing replaced)');

-- ------------------------------------------------ moving out ends it
select lives_ok(format($$select public.pg_settle_move_out(%L, private.today_ist())$$, 'd5000000-0000-4000-8000-000000000004'),
  'resident moves out');
select is((select status::text from public.pg_agreements where stay_id = :rohan_stay), 'ENDED',
  'moving out ends the agreement');

-- ------------------------------------------------ test business delete
select tests.act_as(:super);
update public.tenants set is_test = true where id = :tenant_e;
select lives_ok(format($$select public.delete_test_business(%L, 'Demo PG E')$$, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'a test PG with agreements can be deleted');
reset role;
select is((select count(*)::int from public.pg_agreements where tenant_id = :tenant_e), 0,
  'its agreements are gone');

select * from finish();
rollback;
