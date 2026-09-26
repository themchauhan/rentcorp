-- Phase 9: manual subscriptions and read-only mode for businesses whose
-- trial/subscription has ended or that are suspended.
--
-- Read-only is enforced here, not just in the app: every tenant write
-- policy now requires private.current_writable_tenant_id(), which is NULL
-- for a business without access. Reads are unchanged, so data stays
-- visible and nothing is ever deleted because of expiry.

-- The caller's tenant, only if their profile is ACTIVE and the business
-- currently has access (mirrors tenantAccess() in src/lib/auth/access.ts).
create function private.current_writable_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = (select auth.uid())
    and p.status = 'ACTIVE'
    and (
      (t.status = 'ACTIVE' and (t.subscription_ends_at is null or t.subscription_ends_at > now()))
      or (t.status = 'TRIAL' and (t.trial_ends_at is null or t.trial_ends_at > now()))
    )
$$;
revoke all on function private.current_writable_tenant_id() from public;
grant execute on function private.current_writable_tenant_id() to authenticated, service_role;

-- Tenant write policies → writable tenant only.
alter policy "rental_items: owners add to own business" on public.rental_items
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');
alter policy "rental_items: owners edit own business" on public.rental_items
  using (tenant_id = (select private.current_writable_tenant_id())
         and (select private.current_app_role()) = 'ADMIN')
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');

alter policy "rental_customers: members add to own business" on public.rental_customers
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "rental_customers: members edit own business" on public.rental_customers
  using (tenant_id = (select private.current_writable_tenant_id()))
  with check (tenant_id = (select private.current_writable_tenant_id()));

alter policy "rental_orders: members add to own business" on public.rental_orders
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "rental_orders: members change discount while open" on public.rental_orders
  using (tenant_id = (select private.current_writable_tenant_id()) and closed_at is null and status <> 'CANCELLED')
  with check (tenant_id = (select private.current_writable_tenant_id()));

alter policy "rental_order_items: members add to own business" on public.rental_order_items
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "rental_returns: members record for own business" on public.rental_returns
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "rental_payments: members record for own business" on public.rental_payments
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "message_log: members append for own business" on public.message_log
  with check (tenant_id = (select private.current_writable_tenant_id()));
alter policy "message_templates: owners add" on public.message_templates
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');
alter policy "message_templates: owners edit" on public.message_templates
  using (tenant_id = (select private.current_writable_tenant_id())
         and (select private.current_app_role()) = 'ADMIN')
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');

-- SECURITY DEFINER actions check write access themselves.
create or replace function public.cancel_booking(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.rental_orders%rowtype;
begin
  if (select private.current_writable_tenant_id()) is null then
    raise exception 'Your account is read-only' using errcode = '42501';
  end if;
  if (select private.current_app_role()) is distinct from 'ADMIN' then
    raise exception 'Only the owner can cancel a booking' using errcode = '42501';
  end if;
  select * into v_order from public.rental_orders
  where id = p_order_id and tenant_id = (select private.current_tenant_id())
  for update;
  if not found then raise exception 'Booking not found' using errcode = '23503'; end if;
  if v_order.status = 'CANCELLED' then raise exception 'Already cancelled' using errcode = '23514'; end if;
  if v_order.closed_at is not null then raise exception 'This booking is closed' using errcode = '23514'; end if;
  if exists (select 1 from public.rental_returns where rental_order_id = p_order_id) then
    raise exception 'Items have already been returned; record the rest instead of cancelling'
      using errcode = '23514';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason' using errcode = '22023';
  end if;

  update public.rental_orders
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = (select auth.uid()),
      cancel_reason = trim(p_reason)
  where id = p_order_id;
end
$$;

create or replace function public.close_booking(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.rental_orders%rowtype;
  v_balance bigint;
begin
  if (select private.current_writable_tenant_id()) is null then
    raise exception 'Your account is read-only' using errcode = '42501';
  end if;
  select * into v_order from public.rental_orders
  where id = p_order_id and tenant_id = (select private.current_tenant_id())
  for update;
  if not found then raise exception 'Booking not found' using errcode = '23503'; end if;
  if v_order.closed_at is not null then raise exception 'Already closed' using errcode = '23514'; end if;
  if v_order.status <> 'RETURNED' then
    raise exception 'All items must be returned before closing' using errcode = '23514';
  end if;
  v_balance := private.final_balance_paise(p_order_id);
  if v_balance > 0 then
    raise exception 'Amount due is not settled' using errcode = '23514';
  end if;

  update public.rental_orders
  set closed_at = now(), closed_by = (select auth.uid())
  where id = p_order_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Subscription payments (recorded by the super admin; no gateway)
-- ---------------------------------------------------------------------------
create type public.subscription_payment_method as enum ('UPI', 'BANK_TRANSFER', 'CASH', 'OTHER');

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  amount_paise bigint not null check (amount_paise between 1 and 1000000000),
  payment_date date not null,
  payment_method public.subscription_payment_method not null,
  reference_number text check (length(reference_number) <= 100),
  period_start date not null,
  period_end date not null,
  notes text check (length(notes) <= 500),
  recorded_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index subscription_payments_tenant_idx on public.subscription_payments (tenant_id, payment_date desc);

create function private.stamp_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.recorded_by := (select auth.uid());
    new.created_at := now();
  end if;
  return new;
end
$$;
create trigger subscription_payments_stamp before insert on public.subscription_payments
  for each row execute function private.stamp_subscription_payment();

alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from anon;
revoke update, delete, truncate on public.subscription_payments from authenticated;

create policy "subscription_payments: platform admins read"
  on public.subscription_payments for select to authenticated
  using ((select private.is_platform_admin()));
create policy "subscription_payments: platform admins record"
  on public.subscription_payments for insert to authenticated
  with check ((select private.is_platform_admin()));
