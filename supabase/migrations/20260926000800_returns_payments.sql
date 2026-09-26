-- Phase 7: returns, payments, discount changes, cancel and close.
--
-- All state changes go through checks in the database:
--  * returns: per booking line, partial/staggered, dated between the
--    booking's start and today (IST), never more than was booked; the
--    booking's status follows automatically.
--  * payments: positive amounts by any member; reversals (negative,
--    against a specific payment) by owners only. Never edited/deleted.
--  * discount: owner or staff may change it while the booking is open;
--    stamped with who/when.
--  * cancel: owner only, before any return; charges stop.
--  * close: only when every item is back and the final bill is settled.
-- Money is integer paise; dates are IST calendar dates.

create type public.payment_mode as enum ('CASH', 'UPI', 'CARD', 'OTHER');
create type public.payment_kind as enum ('PAYMENT', 'REVERSAL');

alter table public.rental_order_items
  add constraint rental_order_items_tenant_id_id_key unique (tenant_id, id);

alter table public.rental_orders
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users (id) on delete restrict,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users (id) on delete restrict,
  add column cancel_reason text check (length(cancel_reason) <= 200);

-- IST "today".
create function private.today_ist()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ---------------------------------------------------------------------------
-- Returns
-- ---------------------------------------------------------------------------
create table public.rental_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  rental_order_id uuid not null,
  rental_order_item_id uuid not null,
  quantity_returned integer not null check (quantity_returned between 1 and 1000000),
  returned_on date not null,
  condition_notes text check (length(condition_notes) <= 500),
  recorded_by uuid references auth.users (id) on delete restrict default auth.uid(),
  recorded_at timestamptz not null default now(),
  foreign key (tenant_id, rental_order_id)
    references public.rental_orders (tenant_id, id) on delete restrict,
  foreign key (tenant_id, rental_order_item_id)
    references public.rental_order_items (tenant_id, id) on delete restrict
);
create index rental_returns_order_idx on public.rental_returns (tenant_id, rental_order_id);
create index rental_returns_item_idx on public.rental_returns (rental_order_item_id);

create function private.check_return()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.rental_order_items%rowtype;
  v_order public.rental_orders%rowtype;
  v_already integer;
begin
  -- Lock the line so concurrent returns can't over-return.
  select * into v_line from public.rental_order_items
  where id = new.rental_order_item_id and tenant_id = new.tenant_id
  for update;
  if not found then raise exception 'Booking line not found' using errcode = '23503'; end if;

  -- The line decides which booking this is.
  new.rental_order_id := v_line.rental_order_id;
  select * into v_order from public.rental_orders where id = v_line.rental_order_id;

  if v_order.status = 'CANCELLED' then
    raise exception 'This booking was cancelled' using errcode = '23514';
  end if;
  if v_order.closed_at is not null then
    raise exception 'This booking is closed' using errcode = '23514';
  end if;
  if new.returned_on < v_order.event_start_date then
    raise exception 'Return date is before the booking started' using errcode = '23514';
  end if;
  if new.returned_on > private.today_ist() then
    raise exception 'Return date can''t be in the future' using errcode = '23514';
  end if;

  select coalesce(sum(quantity_returned), 0) into v_already
  from public.rental_returns where rental_order_item_id = v_line.id;
  if v_already + new.quantity_returned > v_line.quantity then
    raise exception 'Only % of "%" still out', v_line.quantity - v_already, v_line.item_name_snapshot
      using errcode = '23514';
  end if;

  if (select auth.role()) = 'authenticated' then
    new.recorded_by := (select auth.uid());
    new.recorded_at := now();
  end if;
  return new;
end
$$;

-- Keeps the booking status in step with its returns.
create function private.sync_return_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out integer;
begin
  select coalesce(sum(li.quantity), 0) - coalesce(sum(r.returned), 0) into v_out
  from public.rental_order_items li
  left join (
    select rental_order_item_id, sum(quantity_returned) as returned
    from public.rental_returns where rental_order_id = new.rental_order_id
    group by rental_order_item_id
  ) r on r.rental_order_item_id = li.id
  where li.rental_order_id = new.rental_order_id;

  update public.rental_orders
  set status = case when v_out = 0 then 'RETURNED'::public.booking_status
                    else 'PARTIALLY_RETURNED'::public.booking_status end
  where id = new.rental_order_id;
  return null;
end
$$;

create trigger rental_returns_a_force_tenant_id before insert on public.rental_returns
  for each row execute function private.force_tenant_id();
create trigger rental_returns_b_check before insert on public.rental_returns
  for each row execute function private.check_return();
create trigger rental_returns_sync_status after insert on public.rental_returns
  for each row execute function private.sync_return_status();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.rental_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  rental_order_id uuid not null,
  kind public.payment_kind not null default 'PAYMENT',
  -- Positive for payments, negative for reversals.
  amount_paise bigint not null,
  mode public.payment_mode not null,
  reverses_payment_id uuid unique references public.rental_payments (id) on delete restrict,
  received_by uuid references auth.users (id) on delete restrict default auth.uid(),
  received_at timestamptz not null default now(),
  note text check (length(note) <= 200),
  foreign key (tenant_id, rental_order_id)
    references public.rental_orders (tenant_id, id) on delete restrict,
  check (
    (kind = 'PAYMENT' and amount_paise between 1 and 1000000000 and reverses_payment_id is null)
    or (kind = 'REVERSAL' and amount_paise between -1000000000 and -1 and reverses_payment_id is not null)
  )
);
create index rental_payments_order_idx on public.rental_payments (tenant_id, rental_order_id);

create function private.check_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.rental_orders%rowtype;
  v_original public.rental_payments%rowtype;
begin
  select * into v_order from public.rental_orders
  where id = new.rental_order_id and tenant_id = new.tenant_id;
  if not found then raise exception 'Booking not found' using errcode = '23503'; end if;
  if v_order.closed_at is not null then
    raise exception 'This booking is closed' using errcode = '23514';
  end if;

  if new.kind = 'PAYMENT' and v_order.status = 'CANCELLED' then
    raise exception 'This booking was cancelled' using errcode = '23514';
  end if;

  if new.kind = 'REVERSAL' then
    if (select auth.role()) = 'authenticated'
       and (select private.current_app_role()) is distinct from 'ADMIN' then
      raise exception 'Only the owner can reverse a payment' using errcode = '42501';
    end if;
    select * into v_original from public.rental_payments where id = new.reverses_payment_id;
    if not found or v_original.rental_order_id <> new.rental_order_id or v_original.kind <> 'PAYMENT' then
      raise exception 'Payment to reverse not found' using errcode = '23503';
    end if;
    if -new.amount_paise > v_original.amount_paise then
      raise exception 'A reversal can''t be more than the payment' using errcode = '23514';
    end if;
    new.mode := v_original.mode;
  end if;

  if (select auth.role()) = 'authenticated' then
    new.received_by := (select auth.uid());
    new.received_at := now();
  end if;
  return new;
end
$$;

create trigger rental_payments_a_force_tenant_id before insert on public.rental_payments
  for each row execute function private.force_tenant_id();
create trigger rental_payments_b_check before insert on public.rental_payments
  for each row execute function private.check_payment();

-- ---------------------------------------------------------------------------
-- Final bill (SQL mirror of the TypeScript engine, for closing)
-- ---------------------------------------------------------------------------
-- Balance owed once every item is back: returned batches charged from the
-- start to their own return date (inclusive), per-event lines once, the
-- booking discount (flat capped at gross; % half up), minus payments.
-- Must stay in step with src/lib/amount-due.ts (cross-checked in tests).
create function private.final_balance_paise(p_order_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select * from public.rental_orders where id = p_order_id
  ),
  gross as (
    select coalesce(sum(
      case when li.rate_unit_snapshot = 'PER_EVENT' then li.rate_paise_snapshot * li.quantity
      else coalesce((
        select sum(r.quantity_returned::bigint * li.rate_paise_snapshot
                   * ((r.returned_on - o.event_start_date) + 1))
        from public.rental_returns r where r.rental_order_item_id = li.id
      ), 0) end
    ), 0)::bigint as g
    from public.rental_order_items li, o
    where li.rental_order_id = o.id
  ),
  disc as (
    select case o.discount_type
      when 'FLAT' then least(o.discount_value, gross.g)
      when 'PERCENT' then (gross.g * o.discount_value + 5000) / 10000
      else 0 end as d
    from o, gross
  )
  select gross.g - disc.d - coalesce((
    select sum(amount_paise) from public.rental_payments where rental_order_id = p_order_id
  ), 0)
  from gross, disc
$$;

-- ---------------------------------------------------------------------------
-- Actions (called through the user's session)
-- ---------------------------------------------------------------------------

-- Records several returns for one booking atomically.
-- p_items: [{"line_id": uuid, "quantity": int}, ...]
create function public.record_returns(
  p_order_id uuid,
  p_returned_on date,
  p_items jsonb,
  p_notes text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  if not exists (select 1 from public.rental_orders where id = p_order_id) then
    raise exception 'Booking not found' using errcode = '23503';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item ->> 'quantity')::integer > 0 then
      insert into public.rental_returns (rental_order_id, rental_order_item_id, quantity_returned, returned_on, condition_notes)
      select p_order_id, li.id, (v_item ->> 'quantity')::integer, p_returned_on, nullif(trim(p_notes), '')
      from public.rental_order_items li
      where li.id = (v_item ->> 'line_id')::uuid and li.rental_order_id = p_order_id;
      if not found then raise exception 'Booking line not found' using errcode = '23503'; end if;
      v_count := v_count + 1;
    end if;
  end loop;
  if v_count = 0 then raise exception 'Enter a quantity to return' using errcode = '22023'; end if;
  return v_count;
end
$$;

create function public.cancel_booking(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.rental_orders%rowtype;
begin
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

create function public.close_booking(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.rental_orders%rowtype;
  v_balance bigint;
begin
  if (select private.current_tenant_id()) is null then
    raise exception 'Not allowed' using errcode = '42501';
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

-- Discount changes: only these columns, only while open (enforced by the
-- policy below and this trigger), stamped by private.stamp_discount().
create function private.check_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and (old.closed_at is not null or old.status = 'CANCELLED') then
    raise exception 'This booking can no longer be changed' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger rental_orders_d_check_update before update on public.rental_orders
  for each row execute function private.check_order_update();

grant update (discount_type, discount_value, discount_reason) on public.rental_orders to authenticated;
create policy "rental_orders: members change discount while open"
  on public.rental_orders for update to authenticated
  using (tenant_id = (select private.current_tenant_id()) and closed_at is null and status <> 'CANCELLED')
  with check (tenant_id = (select private.current_tenant_id()));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rental_returns enable row level security;
alter table public.rental_payments enable row level security;
revoke all on public.rental_returns, public.rental_payments from anon;
revoke update, delete, truncate on public.rental_returns, public.rental_payments from authenticated;

create policy "rental_returns: members read own business"
  on public.rental_returns for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "rental_returns: members record for own business"
  on public.rental_returns for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));

create policy "rental_payments: members read own business"
  on public.rental_payments for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "rental_payments: members record for own business"
  on public.rental_payments for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));

revoke all on function public.record_returns(uuid, date, jsonb, text) from public, anon;
revoke all on function public.cancel_booking(uuid, text) from public, anon;
revoke all on function public.close_booking(uuid) from public, anon;
grant execute on function public.record_returns(uuid, date, jsonb, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.close_booking(uuid) to authenticated;
revoke all on function private.final_balance_paise(uuid) from public;
