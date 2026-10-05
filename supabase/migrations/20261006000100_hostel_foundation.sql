-- Phase 13a: Hostel / PG business type, rooms, beds, meal plans, settings.
-- A business is either a tent house (the original product) or a hostel/PG.
-- The super admin chooses at creation; owners can't change it (tenants has
-- no owner update policy). Every PG table's writes also require the
-- caller's business to be a PG, on top of the usual writable-tenant check.
-- Money is integer paise (rule 8). Nothing here is ever deleted.

create type public.business_type as enum ('TENT_HOUSE', 'HOSTEL_PG');
alter table public.tenants
  add column business_type public.business_type not null default 'TENT_HOUSE';

-- provision_tenant_with_owner gains p_business_type (new signature → recreate).
drop function public.provision_tenant_with_owner(text, uuid, text, text, text, integer, boolean);
create function public.provision_tenant_with_owner(
  p_tenant_name text,
  p_owner_id uuid,
  p_owner_name text,
  p_owner_mobile text,
  p_tenant_phone text default null,
  p_trial_days integer default 30,
  p_is_test boolean default false,
  p_business_type public.business_type default 'TENT_HOUSE'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  insert into public.tenants (name, phone, status, plan, trial_ends_at, is_test, business_type)
  values (p_tenant_name, p_tenant_phone, 'TRIAL', 'TRIAL', now() + make_interval(days => p_trial_days),
          p_is_test, p_business_type)
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, name, mobile, role, status, must_change_password)
  values (p_owner_id, v_tenant_id, p_owner_name, p_owner_mobile, 'ADMIN', 'ACTIVE', true);

  if p_business_type = 'HOSTEL_PG' then
    insert into public.pg_settings (tenant_id) values (v_tenant_id);
  end if;

  return v_tenant_id;
end
$$;
revoke all on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer, boolean, public.business_type)
  from public, anon, authenticated;
grant execute on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer, boolean, public.business_type)
  to service_role;

-- Type can't change once data exists for the other type: simplest rule is
-- "never" — enforced here so even the super admin's client can't flip it.
create function private.keep_business_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_type is distinct from old.business_type then
    raise exception 'A business''s type can''t be changed' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger tenants_keep_business_type before update on public.tenants
  for each row execute function private.keep_business_type();

-- The caller's business type (ACTIVE profile only).
create function private.current_business_type()
returns public.business_type
language sql
stable
security definer
set search_path = ''
as $$
  select t.business_type
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = (select auth.uid()) and p.status = 'ACTIVE'
$$;
revoke all on function private.current_business_type() from public;
grant execute on function private.current_business_type() to authenticated, service_role;

-- The caller's tenant, only if it is a hostel/PG that can currently write.
create function private.writable_pg_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.current_business_type() = 'HOSTEL_PG'
              then private.current_writable_tenant_id() end
$$;
revoke all on function private.writable_pg_tenant_id() from public;
grant execute on function private.writable_pg_tenant_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rooms and beds
-- ---------------------------------------------------------------------------

-- PER_BED: each bed is let separately at rent_paise.
-- PER_ROOM: the whole room is let to one resident at rent_paise.
create type public.pg_rent_mode as enum ('PER_BED', 'PER_ROOM');

create table public.pg_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 40),
  floor text check (floor is null or length(trim(floor)) between 1 and 30),
  rent_mode public.pg_rent_mode not null,
  -- ₹0 to ₹10 lakh a month.
  rent_paise bigint not null check (rent_paise between 0 and 100000000),
  under_maintenance boolean not null default false,
  notes text check (notes is null or length(notes) <= 500),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index pg_rooms_tenant_name_key on public.pg_rooms (tenant_id, lower(trim(name)));

create table public.pg_beds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  room_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 10),
  under_maintenance boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, room_id) references public.pg_rooms (tenant_id, id) on delete restrict
);
create unique index pg_beds_room_label_key on public.pg_beds (tenant_id, room_id, lower(trim(label)));
create index pg_beds_room_idx on public.pg_beds (room_id);

-- A bed can't move to another room.
create function private.keep_bed_room()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.room_id is distinct from old.room_id then
    raise exception 'A bed can''t move to another room' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger pg_beds_keep_room before update on public.pg_beds
  for each row execute function private.keep_bed_room();

-- ---------------------------------------------------------------------------
-- Meal plans and settings
-- ---------------------------------------------------------------------------

create table public.pg_meal_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 60),
  monthly_paise bigint not null check (monthly_paise between 0 and 10000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index pg_meal_plans_tenant_name_key
  on public.pg_meal_plans (tenant_id, lower(trim(name)));

create table public.pg_settings (
  tenant_id uuid primary key default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  -- Defaults offered when a resident moves in (each stay keeps its own copy).
  electricity_paise bigint not null default 0 check (electricity_paise between 0 and 10000000),
  deposit_paise bigint not null default 0 check (deposit_paise between 0 and 100000000),
  notice_days integer not null default 30 check (notice_days between 0 and 180),
  updated_by uuid references auth.users (id) on delete restrict default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers, RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['pg_rooms', 'pg_beds', 'pg_meal_plans', 'pg_settings'] loop
    execute format(
      'create trigger %1$s_force_tenant_id before insert or update on public.%1$s
         for each row execute function private.force_tenant_id()', t);
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$s
         for each row execute function private.set_updated_at()', t);
    execute format('alter table public.%s enable row level security', t);
    execute format('revoke all on public.%s from anon', t);
    execute format('revoke delete, truncate on public.%s from authenticated', t);
    execute format(
      'create policy "%1$s: members read own business" on public.%1$s
         for select to authenticated
         using (tenant_id = (select private.current_tenant_id()))', t);
    execute format(
      'create policy "%1$s: owners add to own PG" on public.%1$s
         for insert to authenticated
         with check (tenant_id = (select private.writable_pg_tenant_id())
                     and (select private.current_app_role()) = ''ADMIN'')', t);
    execute format(
      'create policy "%1$s: owners edit own PG" on public.%1$s
         for update to authenticated
         using (tenant_id = (select private.writable_pg_tenant_id())
                and (select private.current_app_role()) = ''ADMIN'')
         with check (tenant_id = (select private.writable_pg_tenant_id())
                     and (select private.current_app_role()) = ''ADMIN'')', t);
  end loop;
end
$$;

-- Platform admins can see PG setup (support).
create policy "pg_rooms: platform admins read" on public.pg_rooms
  for select to authenticated using ((select private.is_platform_admin()));

-- New room with its beds in one go (runs as the caller: RLS applies).
create function public.pg_create_room(
  p_name text,
  p_floor text,
  p_rent_mode public.pg_rent_mode,
  p_rent_paise bigint,
  p_beds integer,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room uuid;
  i integer;
begin
  if p_beds is null or p_beds < 1 or p_beds > 20 then
    raise exception 'A room has 1 to 20 beds' using errcode = '22023';
  end if;
  insert into public.pg_rooms (name, floor, rent_mode, rent_paise, notes)
  values (trim(p_name), nullif(trim(coalesce(p_floor, '')), ''), p_rent_mode, p_rent_paise,
          nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_room;
  for i in 1..p_beds loop
    insert into public.pg_beds (room_id, label) values (v_room, chr(64 + i));
  end loop;
  return v_room;
end
$$;
revoke all on function public.pg_create_room(text, text, public.pg_rent_mode, bigint, integer, text)
  from public, anon;
grant execute on function public.pg_create_room(text, text, public.pg_rent_mode, bigint, integer, text)
  to authenticated;
