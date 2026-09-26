-- Shared helpers for RLS tests. Runs first (files run in name order) and
-- installs pgTAP plus `tests.act_as(uuid)` / `tests.act_as_anon()`.
begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Impersonate a signed-in user for the rest of the transaction, exactly as
-- PostgREST does for a request carrying that user's JWT.
create or replace function tests.act_as(user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end $$;

create or replace function tests.act_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_function('tests', 'act_as', array['uuid']);
select * from finish();
commit;
