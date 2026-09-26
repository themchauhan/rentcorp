-- Test businesses: a super admin can mark a business as a test and then
-- permanently delete it with everything in it. This is the ONLY hard
-- delete in the system (project rule 6 exception, for test data only).
--
-- Safeguards, all enforced here:
--  * caller must be a platform admin;
--  * the business must be marked is_test;
--  * the caller must pass the business's exact name as confirmation;
--  * one transaction: everything goes or nothing does;
--  * a platform-level audit entry records what was deleted.

alter table public.tenants add column is_test boolean not null default false;

-- provision_tenant_with_owner gains p_is_test (new signature → recreate).
drop function public.provision_tenant_with_owner(text, uuid, text, text, text, integer);
create function public.provision_tenant_with_owner(
  p_tenant_name text,
  p_owner_id uuid,
  p_owner_name text,
  p_owner_mobile text,
  p_tenant_phone text default null,
  p_trial_days integer default 30,
  p_is_test boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  insert into public.tenants (name, phone, status, plan, trial_ends_at, is_test)
  values (p_tenant_name, p_tenant_phone, 'TRIAL', 'TRIAL', now() + make_interval(days => p_trial_days), p_is_test)
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, name, mobile, role, status, must_change_password)
  values (p_owner_id, v_tenant_id, p_owner_name, p_owner_mobile, 'ADMIN', 'ACTIVE', true);

  return v_tenant_id;
end
$$;
revoke all on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.provision_tenant_with_owner(text, uuid, text, text, text, integer, boolean)
  to service_role;

create function public.delete_test_business(p_tenant_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_users uuid[];
  v_counts jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Only the platform admin can delete a business' using errcode = '42501';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id for update;
  if not found then raise exception 'Business not found' using errcode = '23503'; end if;
  if not v_tenant.is_test then
    raise exception 'Only businesses marked as Test can be deleted' using errcode = '23514';
  end if;
  if p_confirm_name is distinct from v_tenant.name then
    raise exception 'Type the business name exactly to confirm' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}') into v_users from public.profiles where tenant_id = p_tenant_id;

  v_counts := jsonb_build_object(
    'logins', coalesce(array_length(v_users, 1), 0),
    'items', (select count(*) from public.rental_items where tenant_id = p_tenant_id),
    'customers', (select count(*) from public.rental_customers where tenant_id = p_tenant_id),
    'bookings', (select count(*) from public.rental_orders where tenant_id = p_tenant_id),
    'payments', (select count(*) from public.rental_payments where tenant_id = p_tenant_id)
  );

  -- Children first (foreign keys are ON DELETE RESTRICT on purpose).
  delete from public.message_log           where tenant_id = p_tenant_id;
  delete from public.rental_returns        where tenant_id = p_tenant_id;
  delete from public.rental_payments       where tenant_id = p_tenant_id and kind = 'REVERSAL';
  delete from public.rental_payments       where tenant_id = p_tenant_id;
  delete from public.rental_order_items    where tenant_id = p_tenant_id;
  delete from public.rental_orders         where tenant_id = p_tenant_id;
  delete from private.booking_counters     where tenant_id = p_tenant_id;
  delete from public.rental_customers      where tenant_id = p_tenant_id;
  delete from public.rental_items          where tenant_id = p_tenant_id;
  delete from public.message_templates     where tenant_id = p_tenant_id;
  delete from public.subscription_payments where tenant_id = p_tenant_id;
  delete from public.audit_logs            where tenant_id = p_tenant_id or user_id = any(v_users);
  delete from public.profiles              where tenant_id = p_tenant_id;
  delete from public.tenants               where id = p_tenant_id;
  -- Their logins, so the mobile numbers can be used again.
  delete from auth.users                   where id = any(v_users);

  -- Platform-level record (no tenant: it no longer exists).
  insert into public.audit_logs (tenant_id, action, target_type, target_id, metadata)
  values (null, 'tenant.test_deleted', 'tenant', p_tenant_id::text,
          jsonb_build_object('name', v_tenant.name) || v_counts);

  return v_counts;
end
$$;
revoke all on function public.delete_test_business(uuid, text) from public, anon;
grant execute on function public.delete_test_business(uuid, text) to authenticated;
