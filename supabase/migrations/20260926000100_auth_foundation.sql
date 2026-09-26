-- Phase 1b: tenants, profiles, platform admins, audit log, and the
-- helper functions every tenant-scoped RLS policy relies on.
--
-- Tenant identity rule: tenant_id is always derived from the signed-in
-- user's profile inside the database (private.current_tenant_id()),
-- never trusted from a client payload.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('SUPER_ADMIN', 'ADMIN', 'STAFF');
create type public.tenant_status as enum ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED');
create type public.profile_status as enum ('ACTIVE', 'INACTIVE');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  phone text,
  email text,
  status public.tenant_status not null default 'TRIAL',
  plan text,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tenant members only (ADMIN / STAFF). SUPER_ADMIN lives in
-- platform_admins, so tenant_id is never null here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  -- 10-digit Indian mobile, also the login identifier.
  mobile text not null unique check (mobile ~ '^[6-9][0-9]{9}$'),
  role public.app_role not null check (role <> 'SUPER_ADMIN'),
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_tenant_id_idx on public.profiles (tenant_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

-- Append-only. tenant_id is null only for platform-level events.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id) on delete restrict,
  user_id uuid references auth.users (id) on delete restrict,
  action text not null check (length(action) between 1 and 100),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Private helpers (schema is not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- SECURITY DEFINER so policies can read profiles without recursing into
-- profiles' own RLS. search_path is pinned to avoid hijacking.

-- Tenant of the signed-in user, or NULL if they have no ACTIVE profile.
-- A deactivated user therefore sees no tenant data even with a valid token.
create function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.tenant_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'ACTIVE'
$$;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = (select auth.uid())
  )
$$;

-- SUPER_ADMIN, or the ACTIVE profile's role, else NULL.
create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_platform_admin() then 'SUPER_ADMIN'::public.app_role
    else (
      select p.role from public.profiles p
      where p.id = (select auth.uid()) and p.status = 'ACTIVE'
    )
  end
$$;

-- Trigger for every tenant-owned table: for signed-in users, tenant_id is
-- overwritten with the caller's own tenant on insert and cannot be changed
-- on update, whatever the request sent. Server-side provisioning
-- (service_role) and migrations/seeds are left alone.
create function private.force_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      new.tenant_id := private.current_tenant_id();
    else
      new.tenant_id := old.tenant_id;
    end if;
  end if;
  return new;
end
$$;

-- Audit rows: actor, tenant and timestamp always come from the session.
-- Platform admins may set tenant_id to the tenant an action concerns.
create function private.force_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.user_id := (select auth.uid());
    if not private.is_platform_admin() then
      new.tenant_id := private.current_tenant_id();
    end if;
    new.created_at := now();
  end if;
  return new;
end
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.current_tenant_id(),
  private.is_platform_admin(),
  private.current_app_role()
to authenticated, service_role;

create trigger tenants_updated_at before update on public.tenants
  for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profiles_force_tenant_id before insert or update on public.profiles
  for each row execute function private.force_tenant_id();
create trigger audit_logs_force_actor before insert on public.audit_logs
  for each row execute function private.force_audit_actor();
