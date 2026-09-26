-- Phase 10: schema-wide security invariants. These fail automatically if
-- a future migration adds a table or function that breaks the rules.
begin;
select plan(7);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '', 'every table in public has row-level security enabled');

select is(
  (select coalesce(string_agg(distinct table_name, ', '), '')
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  '', 'signed-out visitors (anon) have no privileges on any table');

select is(
  (select coalesce(string_agg(distinct table_name || ':' || privilege_type, ', '), '')
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('DELETE', 'TRUNCATE')),
  '', 'signed-in users can never DELETE or TRUNCATE (soft-delete only)');

select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ', '), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '', 'every SECURITY DEFINER function pins its search_path');

select is(
  (select coalesce(string_agg(p.proname, ', '), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  '', 'anon cannot execute any public function');

select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon cannot use the private schema');

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  '', 'no public table is RLS-enabled but policy-less by accident');

select * from finish();
rollback;
