-- Phase 1c: account provisioning and temporary passwords.

-- Set when an admin creates an account or resets its password; the user
-- must choose their own password on next login.
alter table public.profiles
  add column must_change_password boolean not null default false;

-- Lets a signed-in user clear their own flag after changing their
-- password. Touches only the caller's row; users have no UPDATE policy on
-- profiles, so this is the only way they can change it.
create function public.mark_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set must_change_password = false
  where id = (select auth.uid());
$$;

revoke all on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- Creates a business and its owner profile in one transaction. The Auth
-- user must already exist. Server-side only (service_role): called by the
-- super admin "New business" action through the secret-key client.
create function public.provision_tenant_with_owner(
  p_tenant_name text,
  p_owner_id uuid,
  p_owner_name text,
  p_owner_mobile text,
  p_tenant_phone text default null,
  p_trial_days integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  insert into public.tenants (name, phone, status, plan, trial_ends_at)
  values (p_tenant_name, p_tenant_phone, 'TRIAL', 'TRIAL', now() + make_interval(days => p_trial_days))
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, name, mobile, role, status, must_change_password)
  values (p_owner_id, v_tenant_id, p_owner_name, p_owner_mobile, 'ADMIN', 'ACTIVE', true);

  return v_tenant_id;
end
$$;

revoke all on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer)
  to service_role;
