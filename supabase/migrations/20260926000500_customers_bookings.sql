-- Phase 3: customers, bookings (rental_orders) and booking lines
-- (rental_order_items).
--
-- Guarantees enforced here, not just in the app:
--  * tenant_id always comes from the session (default + force trigger).
--  * A booking can only reference a customer / item of the SAME business
--    (composite foreign keys on (tenant_id, id)).
--  * Rates are snapshotted from the catalog by a trigger at insert time;
--    whatever the client sends for them is overwritten (project rule 8).
--  * No DELETE anywhere; booking lines are never edited.
-- Money is integer paise.

create type public.message_channel as enum ('WHATSAPP', 'SMS');
create type public.booking_status as enum (
  'ACTIVE', 'PARTIALLY_RETURNED', 'RETURNED', 'OVERDUE', 'CANCELLED'
);
create type public.discount_type as enum ('NONE', 'FLAT', 'PERCENT');

-- Allows composite foreign keys from bookings to catalog items.
alter table public.rental_items
  add constraint rental_items_tenant_id_id_key unique (tenant_id, id);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.rental_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  -- NULL = not on WhatsApp.
  whatsapp_number text check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  preferred_channel public.message_channel not null default 'WHATSAPP',
  address text check (length(address) <= 500),
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  -- Can't prefer WhatsApp without a WhatsApp number.
  check (preferred_channel = 'SMS' or whatsapp_number is not null)
);
create index rental_customers_tenant_mobile_idx on public.rental_customers (tenant_id, mobile);
create index rental_customers_tenant_name_idx on public.rental_customers (tenant_id, lower(name));

create trigger rental_customers_force_tenant_id before insert or update on public.rental_customers
  for each row execute function private.force_tenant_id();
create trigger rental_customers_updated_at before update on public.rental_customers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Per-business booking numbers (#1, #2, ...)
-- ---------------------------------------------------------------------------
create table private.booking_counters (
  tenant_id uuid primary key references public.tenants (id) on delete restrict,
  last_number integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.rental_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  booking_number integer not null,
  customer_id uuid not null,
  order_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  event_start_date date not null,
  event_start_time time,
  expected_return_date date not null,
  status public.booking_status not null default 'ACTIVE',
  security_deposit_paise bigint check (security_deposit_paise between 0 and 1000000000),
  -- FLAT: discount_value is paise. PERCENT: basis points (1000 = 10%).
  discount_type public.discount_type not null default 'NONE',
  discount_value bigint not null default 0,
  discount_reason text check (length(discount_reason) <= 200),
  discount_updated_by uuid references auth.users (id) on delete restrict,
  discount_updated_at timestamptz,
  notes text check (length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, booking_number),
  foreign key (tenant_id, customer_id)
    references public.rental_customers (tenant_id, id) on delete restrict,
  check (expected_return_date >= event_start_date),
  check (
    (discount_type = 'NONE' and discount_value = 0)
    or (discount_type = 'FLAT' and discount_value between 0 and 1000000000)
    or (discount_type = 'PERCENT' and discount_value between 0 and 10000)
  )
);
create index rental_orders_tenant_status_idx on public.rental_orders (tenant_id, status);
create index rental_orders_tenant_dates_idx
  on public.rental_orders (tenant_id, event_start_date, expected_return_date);
create index rental_orders_customer_idx on public.rental_orders (tenant_id, customer_id);

-- Allocates the next booking number for the booking's business. The row
-- lock on the counter serialises concurrent bookings.
create function private.assign_booking_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.booking_counters (tenant_id, last_number)
  values (new.tenant_id, 1)
  on conflict (tenant_id)
    do update set last_number = private.booking_counters.last_number + 1
  returning last_number into new.booking_number;
  return new;
end
$$;

-- Discount audit columns always reflect who set it, from the session.
create function private.stamp_discount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.discount_type is distinct from old.discount_type
     or new.discount_value is distinct from old.discount_value
     or new.discount_reason is distinct from old.discount_reason then
    if new.discount_type = 'NONE' and tg_op = 'INSERT' then
      new.discount_updated_by := null;
      new.discount_updated_at := null;
    else
      new.discount_updated_by := (select auth.uid());
      new.discount_updated_at := now();
    end if;
  end if;
  return new;
end
$$;

-- Order matters: tenant first, then the number that depends on it.
create trigger rental_orders_a_force_tenant_id before insert or update on public.rental_orders
  for each row execute function private.force_tenant_id();
create trigger rental_orders_b_booking_number before insert on public.rental_orders
  for each row execute function private.assign_booking_number();
create trigger rental_orders_c_discount before insert or update on public.rental_orders
  for each row execute function private.stamp_discount();
create trigger rental_orders_updated_at before update on public.rental_orders
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Booking lines
-- ---------------------------------------------------------------------------
create table public.rental_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  rental_order_id uuid not null,
  rental_item_id uuid not null,
  quantity integer not null check (quantity between 1 and 1000000),
  -- Snapshots, copied from the catalog by trigger at insert time.
  item_name_snapshot text not null,
  unit_label_snapshot text not null,
  rate_paise_snapshot bigint not null check (rate_paise_snapshot >= 0),
  rate_unit_snapshot public.rate_unit not null,
  created_at timestamptz not null default now(),
  unique (rental_order_id, rental_item_id),
  foreign key (tenant_id, rental_order_id)
    references public.rental_orders (tenant_id, id) on delete restrict,
  foreign key (tenant_id, rental_item_id)
    references public.rental_items (tenant_id, id) on delete restrict
);
create index rental_order_items_order_idx on public.rental_order_items (rental_order_id);
create index rental_order_items_item_idx on public.rental_order_items (tenant_id, rental_item_id);

-- Copies name/unit/rate from the catalog item of the same business. Any
-- client-supplied snapshot values are overwritten. Inactive items can't be
-- booked.
create function private.snapshot_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.rental_items%rowtype;
begin
  select * into v_item
  from public.rental_items i
  where i.id = new.rental_item_id and i.tenant_id = new.tenant_id;

  if not found then
    raise exception 'Item not found' using errcode = '23503';
  end if;
  if not v_item.active then
    raise exception 'Item "%" is deactivated', v_item.name using errcode = '23514';
  end if;

  new.item_name_snapshot := v_item.name;
  new.unit_label_snapshot := v_item.unit_label;
  new.rate_paise_snapshot := v_item.rate_paise;
  new.rate_unit_snapshot := v_item.rate_unit;
  return new;
end
$$;

create trigger rental_order_items_a_force_tenant_id before insert or update on public.rental_order_items
  for each row execute function private.force_tenant_id();
create trigger rental_order_items_b_snapshot before insert on public.rental_order_items
  for each row execute function private.snapshot_order_item();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rental_customers enable row level security;
alter table public.rental_orders enable row level security;
alter table public.rental_order_items enable row level security;
alter table private.booking_counters enable row level security;

revoke all on public.rental_customers, public.rental_orders, public.rental_order_items from anon;
revoke delete, truncate on public.rental_customers, public.rental_orders, public.rental_order_items
  from authenticated;
-- Booking lines are immutable; booking changes (returns, discount edits,
-- status) arrive in later phases with their own policies.
revoke update on public.rental_order_items from authenticated;
revoke update on public.rental_orders from authenticated;

-- Owners and staff both work with customers and bookings.
create policy "rental_customers: members read own business"
  on public.rental_customers for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "rental_customers: members add to own business"
  on public.rental_customers for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));
create policy "rental_customers: members edit own business"
  on public.rental_customers for update to authenticated
  using (tenant_id = (select private.current_tenant_id()))
  with check (tenant_id = (select private.current_tenant_id()));

create policy "rental_orders: members read own business"
  on public.rental_orders for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "rental_orders: members add to own business"
  on public.rental_orders for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));

create policy "rental_order_items: members read own business"
  on public.rental_order_items for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "rental_order_items: members add to own business"
  on public.rental_order_items for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));

-- ---------------------------------------------------------------------------
-- Atomic booking creation
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: runs as the signed-in user, so RLS and every trigger
-- above apply. Creates the booking and all its lines in one transaction.
-- p_lines: [{"item_id": uuid, "quantity": int}, ...]
create function public.create_booking(
  p_customer_id uuid,
  p_event_start_date date,
  p_expected_return_date date,
  p_lines jsonb,
  p_event_start_time time default null,
  p_security_deposit_paise bigint default null,
  p_discount_type public.discount_type default 'NONE',
  p_discount_value bigint default 0,
  p_discount_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_line jsonb;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;

  insert into public.rental_orders (
    customer_id, event_start_date, event_start_time, expected_return_date,
    security_deposit_paise, discount_type, discount_value, discount_reason, notes
  )
  values (
    p_customer_id, p_event_start_date, p_event_start_time, p_expected_return_date,
    p_security_deposit_paise, p_discount_type, p_discount_value,
    nullif(trim(p_discount_reason), ''), nullif(trim(p_notes), '')
  )
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.rental_order_items (
      rental_order_id, rental_item_id, quantity,
      -- Placeholders; the snapshot trigger overwrites them from the catalog.
      item_name_snapshot, unit_label_snapshot, rate_paise_snapshot, rate_unit_snapshot
    )
    values (
      v_order_id, (v_line ->> 'item_id')::uuid, (v_line ->> 'quantity')::integer,
      '', '', 0, 'PER_DAY'
    );
  end loop;

  return v_order_id;
end
$$;

revoke all on function public.create_booking(uuid, date, date, jsonb, time, bigint, public.discount_type, bigint, text, text)
  from public, anon;
grant execute on function public.create_booking(uuid, date, date, jsonb, time, bigint, public.discount_type, bigint, text, text)
  to authenticated;

-- Quantity of each item already committed to other open bookings that
-- overlap the given dates (or are overdue). Runs as the caller: RLS limits
-- it to their own business. Used for the "only N free" warning.
create function public.item_commitments(p_start date, p_end date)
returns table (rental_item_id uuid, committed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select li.rental_item_id, sum(li.quantity)::integer
  from public.rental_order_items li
  join public.rental_orders o on o.id = li.rental_order_id
  where o.status in ('ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE')
    and (
      (o.event_start_date <= p_end and o.expected_return_date >= p_start)
      or o.status = 'OVERDUE'
    )
  group by li.rental_item_id
$$;

revoke all on function public.item_commitments(date, date) from public, anon;
grant execute on function public.item_commitments(date, date) to authenticated;
