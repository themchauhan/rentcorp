-- Phase 13b: residents, stays, rate snapshots, monthly dues, payments.
--
-- A "stay" is one resident occupying one bed (PER_BED room) or a whole room
-- (PER_ROOM). Rent is due on the joining date every month: cycle k starts
-- on start_date + k months (Postgres clamps to the month end, same as
-- addMonths() in src/lib/subscriptions.ts), so a 31 Jan joiner is due
-- 28/29 Feb, then 31 Mar.
--
-- Rates are snapshotted per stay (rule 8): pg_stay_rates rows are copied
-- from the room / meal plan / settings at move-in, and a change only ever
-- applies from a FUTURE due date. Later room or plan price changes never
-- touch an existing stay. All amounts are computed (TypeScript engine
-- src/lib/pg-dues.ts, mirrored here by private.pg_stay_*_paise), never
-- typed in, except owner adjustments (extra charge / discount) which carry
-- a reason and are audit-logged by the app.
--
-- Stays, rates and adjustments are written only through the functions
-- below; payments are append-only (mistakes are reversed, never edited).

-- ---------------------------------------------------------------------------
-- Resident details (the person is a rental_customers row)
-- ---------------------------------------------------------------------------

create type public.pg_id_type as enum
  ('AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VOTER_ID', 'PASSPORT', 'COLLEGE_ID', 'OTHER');

create table public.pg_resident_details (
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  customer_id uuid not null,
  emergency_name text check (emergency_name is null or length(trim(emergency_name)) between 1 and 120),
  emergency_mobile text check (emergency_mobile is null or emergency_mobile ~ '^[6-9][0-9]{9}$'),
  occupation text check (occupation is null or length(trim(occupation)) between 1 and 120),
  permanent_address text check (permanent_address is null or length(permanent_address) <= 500),
  id_type public.pg_id_type,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, customer_id),
  foreign key (tenant_id, customer_id) references public.rental_customers (tenant_id, id) on delete restrict
);

create trigger pg_resident_details_force_tenant_id before insert or update on public.pg_resident_details
  for each row execute function private.force_tenant_id();
create trigger pg_resident_details_updated_at before update on public.pg_resident_details
  for each row execute function private.set_updated_at();
alter table public.pg_resident_details enable row level security;
revoke all on public.pg_resident_details from anon;
revoke delete, truncate on public.pg_resident_details from authenticated;
create policy "pg_resident_details: members read own business" on public.pg_resident_details
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_resident_details: members add to own PG" on public.pg_resident_details
  for insert to authenticated with check (tenant_id = (select private.writable_pg_tenant_id()));
create policy "pg_resident_details: members edit own PG" on public.pg_resident_details
  for update to authenticated
  using (tenant_id = (select private.writable_pg_tenant_id()))
  with check (tenant_id = (select private.writable_pg_tenant_id()));

-- ---------------------------------------------------------------------------
-- Stays
-- ---------------------------------------------------------------------------

create type public.pg_stay_status as enum ('ACTIVE', 'NOTICE', 'MOVED_OUT', 'CANCELLED');

create table public.pg_stays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  customer_id uuid not null,
  room_id uuid not null,
  -- NULL for a PER_ROOM room (the stay takes the whole room).
  bed_id uuid,
  start_date date not null,
  status public.pg_stay_status not null default 'ACTIVE',
  -- Deposit agreed at move-in (what is actually held = DEPOSIT payments).
  deposit_paise bigint not null default 0 check (deposit_paise between 0 and 100000000),
  notice_given_on date,
  planned_move_out date,
  moved_out_on date,
  settled_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references public.rental_customers (tenant_id, id) on delete restrict,
  foreign key (tenant_id, room_id) references public.pg_rooms (tenant_id, id) on delete restrict,
  foreign key (tenant_id, bed_id) references public.pg_beds (tenant_id, id) on delete restrict,
  check (moved_out_on is null or moved_out_on >= start_date),
  check ((status = 'MOVED_OUT') = (moved_out_on is not null)),
  check (status <> 'NOTICE' or (notice_given_on is not null and planned_move_out is not null))
);
-- One live stay per bed, per whole room, and per person.
create unique index pg_stays_bed_live_key on public.pg_stays (bed_id)
  where status in ('ACTIVE', 'NOTICE') and bed_id is not null;
create unique index pg_stays_room_live_key on public.pg_stays (room_id)
  where status in ('ACTIVE', 'NOTICE') and bed_id is null;
create unique index pg_stays_customer_live_key on public.pg_stays (tenant_id, customer_id)
  where status in ('ACTIVE', 'NOTICE');
create index pg_stays_tenant_status_idx on public.pg_stays (tenant_id, status);
create index pg_stays_room_idx on public.pg_stays (room_id);

create trigger pg_stays_updated_at before update on public.pg_stays
  for each row execute function private.set_updated_at();

create table public.pg_stay_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  stay_id uuid not null,
  effective_from date not null,
  rent_paise bigint not null check (rent_paise between 0 and 100000000),
  meal_plan_id uuid,
  meal_plan_name text,
  meal_paise bigint not null default 0 check (meal_paise between 0 and 10000000),
  electricity_paise bigint not null default 0 check (electricity_paise between 0 and 10000000),
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique (stay_id, effective_from),
  foreign key (tenant_id, stay_id) references public.pg_stays (tenant_id, id) on delete restrict,
  foreign key (tenant_id, meal_plan_id) references public.pg_meal_plans (tenant_id, id) on delete restrict,
  check ((meal_plan_id is null) = (meal_plan_name is null))
);

-- Owner adjustments on a stay's account: an extra charge (e.g. damage,
-- short notice) or a discount, always with a reason.
create type public.pg_adjustment_kind as enum ('CHARGE', 'DISCOUNT');

create table public.pg_stay_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  stay_id uuid not null,
  kind public.pg_adjustment_kind not null,
  amount_paise bigint not null check (amount_paise between 1 and 100000000),
  reason text not null check (length(trim(reason)) between 2 and 200),
  on_date date not null,
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, stay_id) references public.pg_stays (tenant_id, id) on delete restrict
);
create index pg_stay_adjustments_stay_idx on public.pg_stay_adjustments (stay_id);

alter table public.pg_stays enable row level security;
alter table public.pg_stay_rates enable row level security;
alter table public.pg_stay_adjustments enable row level security;
revoke all on public.pg_stays, public.pg_stay_rates, public.pg_stay_adjustments from anon;
-- Written only through the security-definer functions below.
revoke insert, update, delete, truncate
  on public.pg_stays, public.pg_stay_rates, public.pg_stay_adjustments from authenticated;
create policy "pg_stays: members read own business" on public.pg_stays
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_stay_rates: members read own business" on public.pg_stay_rates
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_stay_adjustments: members read own business" on public.pg_stay_adjustments
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));

-- A room's rent mode can't change while someone lives in it, and a room or
-- bed can't be deactivated while occupied.
create function private.guard_occupied_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.pg_stays s
             where s.room_id = new.id and s.status in ('ACTIVE', 'NOTICE')) then
    if new.rent_mode is distinct from old.rent_mode then
      raise exception 'Someone lives in this room: its rent type can''t change' using errcode = '23514';
    end if;
    if not new.active and old.active then
      raise exception 'Someone lives in this room: it can''t be removed' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger pg_rooms_guard_occupied before update on public.pg_rooms
  for each row execute function private.guard_occupied_room();

create function private.guard_occupied_bed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.active and old.active and exists (
    select 1 from public.pg_stays s
    where s.status in ('ACTIVE', 'NOTICE')
      and (s.bed_id = new.id or (s.bed_id is null and s.room_id = new.room_id))
  ) then
    raise exception 'Someone uses this bed: it can''t be removed' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger pg_beds_guard_occupied before update on public.pg_beds
  for each row execute function private.guard_occupied_bed();

-- ---------------------------------------------------------------------------
-- Payments (append-only)
-- ---------------------------------------------------------------------------

-- RENT: resident pays towards their account. DEPOSIT: resident pays the
-- deposit (held separately). REFUND: the business pays money back.
create type public.pg_payment_purpose as enum ('RENT', 'DEPOSIT', 'REFUND');

create table public.pg_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  stay_id uuid not null,
  purpose public.pg_payment_purpose not null,
  kind public.payment_kind not null default 'PAYMENT',
  amount_paise bigint not null,
  mode public.payment_mode not null,
  reverses_payment_id uuid unique references public.pg_payments (id) on delete restrict,
  received_by uuid references auth.users (id) on delete restrict default auth.uid(),
  received_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 200),
  foreign key (tenant_id, stay_id) references public.pg_stays (tenant_id, id) on delete restrict,
  check (
    (kind = 'PAYMENT' and amount_paise between 1 and 1000000000 and reverses_payment_id is null)
    or (kind = 'REVERSAL' and amount_paise between -1000000000 and -1 and reverses_payment_id is not null)
  )
);
create index pg_payments_stay_idx on public.pg_payments (tenant_id, stay_id, received_at);
create index pg_payments_received_idx on public.pg_payments (tenant_id, received_at);

create trigger pg_payments_force_tenant_id before insert on public.pg_payments
  for each row execute function private.force_tenant_id();

create function private.check_pg_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.pg_stay_status;
  v_orig public.pg_payments%rowtype;
begin
  select status into v_status from public.pg_stays
  where id = new.stay_id and tenant_id = new.tenant_id;
  if v_status is null then raise exception 'Resident not found' using errcode = '23503'; end if;
  if v_status = 'CANCELLED' then
    raise exception 'This stay was cancelled' using errcode = '23514';
  end if;

  if new.kind = 'REVERSAL' then
    if (select auth.role()) = 'authenticated' and private.current_app_role() <> 'ADMIN' then
      raise exception 'Only the owner can reverse a payment' using errcode = '42501';
    end if;
    select * into v_orig from public.pg_payments
    where id = new.reverses_payment_id and tenant_id = new.tenant_id and stay_id = new.stay_id;
    if not found or v_orig.kind <> 'PAYMENT' then
      raise exception 'Payment to reverse not found' using errcode = '23503';
    end if;
    if -new.amount_paise <> v_orig.amount_paise then
      raise exception 'A reversal cancels the whole payment' using errcode = '23514';
    end if;
    new.mode := v_orig.mode;
    new.purpose := v_orig.purpose;
  elsif new.purpose = 'REFUND' then
    if (select auth.role()) = 'authenticated' and private.current_app_role() <> 'ADMIN' then
      raise exception 'Only the owner can record a refund' using errcode = '42501';
    end if;
  end if;

  if (select auth.role()) = 'authenticated' then
    new.received_by := (select auth.uid());
    new.received_at := now();
  end if;
  return new;
end
$$;
create trigger pg_payments_check before insert on public.pg_payments
  for each row execute function private.check_pg_payment();

alter table public.pg_payments enable row level security;
revoke all on public.pg_payments from anon;
revoke update, delete, truncate on public.pg_payments from authenticated;
create policy "pg_payments: members read own business" on public.pg_payments
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_payments: members record for own PG" on public.pg_payments
  for insert to authenticated with check (tenant_id = (select private.writable_pg_tenant_id()));

-- ---------------------------------------------------------------------------
-- Dues (SQL mirror of src/lib/pg-dues.ts)
-- ---------------------------------------------------------------------------

-- Monthly charges for every cycle that has started by p_as_of (and before
-- the move-out date; the first cycle is always charged).
create function private.pg_stay_cycle_charges_paise(p_stay_id uuid, p_as_of date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select * from public.pg_stays where id = p_stay_id
  ),
  cycles as (
    select k, (s.start_date + make_interval(months => k))::date as cycle_start
    from s, generate_series(0, 1200) as k
    where (s.start_date + make_interval(months => k))::date <= p_as_of
      and (k = 0 or s.moved_out_on is null
           or (s.start_date + make_interval(months => k))::date < s.moved_out_on)
  )
  select coalesce(sum(r.rent_paise + r.meal_paise + r.electricity_paise), 0)::bigint
  from cycles c
  cross join lateral (
    select * from public.pg_stay_rates r
    where r.stay_id = p_stay_id and r.effective_from <= c.cycle_start
    order by r.effective_from desc
    limit 1
  ) r
  where (select status from s) <> 'CANCELLED'
$$;

-- Rent account balance: charges + extra charges − discounts − RENT payments.
-- Positive = the resident owes; negative = credit.
create function private.pg_stay_balance_paise(p_stay_id uuid, p_as_of date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select private.pg_stay_cycle_charges_paise(p_stay_id, p_as_of)
    + coalesce((select sum(case kind when 'CHARGE' then amount_paise else -amount_paise end)
                from public.pg_stay_adjustments where stay_id = p_stay_id), 0)
    - coalesce((select sum(amount_paise) from public.pg_payments
                where stay_id = p_stay_id and purpose = 'RENT'), 0)
$$;

-- Deposit currently held (DEPOSIT payments, net of reversals).
create function private.pg_stay_deposit_held_paise(p_stay_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_paise), 0)::bigint from public.pg_payments
  where stay_id = p_stay_id and purpose = 'DEPOSIT'
$$;

-- After move-out: balance − deposit held + refunds paid. Positive = collect
-- from the resident; negative = refund owed to them; 0 = settled.
create function private.pg_stay_final_paise(p_stay_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select private.pg_stay_balance_paise(p_stay_id, coalesce(s.moved_out_on, (now() at time zone 'Asia/Kolkata')::date))
    - private.pg_stay_deposit_held_paise(p_stay_id)
    + coalesce((select sum(amount_paise) from public.pg_payments
                where stay_id = p_stay_id and purpose = 'REFUND'), 0)
  from public.pg_stays s where s.id = p_stay_id
$$;

revoke all on function private.pg_stay_cycle_charges_paise(uuid, date) from public;
revoke all on function private.pg_stay_balance_paise(uuid, date) from public;
revoke all on function private.pg_stay_deposit_held_paise(uuid) from public;
revoke all on function private.pg_stay_final_paise(uuid) from public;

-- ---------------------------------------------------------------------------
-- Stay functions (each re-checks business, role and state)
-- ---------------------------------------------------------------------------

-- The caller's live stay row (locked), or an error.
create function private.pg_lock_stay(p_stay_id uuid)
returns public.pg_stays
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.writable_pg_tenant_id();
  v_stay public.pg_stays%rowtype;
begin
  if v_tenant is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_stay from public.pg_stays
  where id = p_stay_id and tenant_id = v_tenant for update;
  if not found then raise exception 'Resident not found' using errcode = '23503'; end if;
  return v_stay;
end
$$;
revoke all on function private.pg_lock_stay(uuid) from public;

create function public.pg_move_in(
  p_customer_id uuid,
  p_room_id uuid,
  p_bed_id uuid,
  p_start_date date,
  p_meal_plan_id uuid,
  p_deposit_paise bigint,
  p_rent_paise bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.writable_pg_tenant_id();
  v_room public.pg_rooms%rowtype;
  v_bed public.pg_beds%rowtype;
  v_plan public.pg_meal_plans%rowtype;
  v_elec bigint;
  v_stay uuid;
begin
  if v_tenant is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_rent_paise is not null and private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can set a different rent' using errcode = '42501';
  end if;
  if p_start_date is null
     or p_start_date < private.today_ist() - 366 or p_start_date > private.today_ist() + 90 then
    raise exception 'Joining date must be within the last year or next 3 months' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rental_customers where id = p_customer_id and tenant_id = v_tenant) then
    raise exception 'Resident not found' using errcode = '23503';
  end if;

  -- A bed implies its room.
  if p_bed_id is not null then
    select room_id into p_room_id from public.pg_beds where id = p_bed_id and tenant_id = v_tenant;
  end if;
  select * into v_room from public.pg_rooms where id = p_room_id and tenant_id = v_tenant for update;
  if not found or not v_room.active then raise exception 'Room not found' using errcode = '23503'; end if;
  if v_room.under_maintenance then
    raise exception 'This room is under maintenance' using errcode = '23514';
  end if;

  if v_room.rent_mode = 'PER_BED' then
    select * into v_bed from public.pg_beds
    where id = p_bed_id and room_id = v_room.id and tenant_id = v_tenant;
    if not found or not v_bed.active then raise exception 'Choose a bed' using errcode = '23503'; end if;
    if v_bed.under_maintenance then
      raise exception 'This bed is under maintenance' using errcode = '23514';
    end if;
  else
    if p_bed_id is not null then
      raise exception 'This room is let as a whole' using errcode = '22023';
    end if;
    if exists (select 1 from public.pg_stays where room_id = v_room.id and status in ('ACTIVE', 'NOTICE')) then
      raise exception 'This room is already occupied' using errcode = '23505';
    end if;
  end if;

  if p_meal_plan_id is not null then
    select * into v_plan from public.pg_meal_plans
    where id = p_meal_plan_id and tenant_id = v_tenant and active;
    if not found then raise exception 'Meal plan not found' using errcode = '23503'; end if;
  end if;

  select coalesce((select electricity_paise from public.pg_settings where tenant_id = v_tenant), 0)
  into v_elec;

  insert into public.pg_stays (tenant_id, customer_id, room_id, bed_id, start_date, deposit_paise)
  values (v_tenant, p_customer_id, v_room.id, case when v_room.rent_mode = 'PER_BED' then v_bed.id end,
          p_start_date, coalesce(p_deposit_paise, 0))
  returning id into v_stay;

  insert into public.pg_stay_rates
    (tenant_id, stay_id, effective_from, rent_paise, meal_plan_id, meal_plan_name, meal_paise, electricity_paise)
  values (v_tenant, v_stay, p_start_date, coalesce(p_rent_paise, v_room.rent_paise),
          v_plan.id, v_plan.name, coalesce(v_plan.monthly_paise, 0), v_elec);
  return v_stay;
end
$$;

-- New rent / meal plan / electricity from a FUTURE due date (owner only).
create function public.pg_change_rates(
  p_stay_id uuid,
  p_effective_from date,
  p_rent_paise bigint,
  p_meal_plan_id uuid,
  p_electricity_paise bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
  v_plan public.pg_meal_plans%rowtype;
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can change rates' using errcode = '42501';
  end if;
  if v_stay.status not in ('ACTIVE', 'NOTICE') then
    raise exception 'This resident has moved out' using errcode = '23514';
  end if;
  if p_effective_from is null or p_effective_from <= private.today_ist() then
    raise exception 'New rates start from a future due date' using errcode = '22023';
  end if;
  if not exists (
    select 1 from generate_series(1, 1200) k
    where (v_stay.start_date + make_interval(months => k))::date = p_effective_from
  ) then
    raise exception 'New rates must start on a due date' using errcode = '22023';
  end if;
  if p_meal_plan_id is not null then
    select * into v_plan from public.pg_meal_plans
    where id = p_meal_plan_id and tenant_id = v_stay.tenant_id and active;
    if not found then raise exception 'Meal plan not found' using errcode = '23503'; end if;
  end if;

  insert into public.pg_stay_rates
    (tenant_id, stay_id, effective_from, rent_paise, meal_plan_id, meal_plan_name, meal_paise, electricity_paise)
  values (v_stay.tenant_id, v_stay.id, p_effective_from, p_rent_paise,
          v_plan.id, v_plan.name, coalesce(v_plan.monthly_paise, 0), p_electricity_paise)
  on conflict (stay_id, effective_from) do update
    set rent_paise = excluded.rent_paise,
        meal_plan_id = excluded.meal_plan_id,
        meal_plan_name = excluded.meal_plan_name,
        meal_paise = excluded.meal_paise,
        electricity_paise = excluded.electricity_paise,
        created_by = auth.uid(),
        created_at = now();
end
$$;

create function public.pg_add_adjustment(
  p_stay_id uuid,
  p_kind public.pg_adjustment_kind,
  p_amount_paise bigint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
  v_id uuid;
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can add charges or discounts' using errcode = '42501';
  end if;
  if v_stay.status = 'CANCELLED' then
    raise exception 'This stay was cancelled' using errcode = '23514';
  end if;
  insert into public.pg_stay_adjustments (tenant_id, stay_id, kind, amount_paise, reason, on_date)
  values (v_stay.tenant_id, v_stay.id, p_kind, p_amount_paise, trim(p_reason), private.today_ist())
  returning id into v_id;
  return v_id;
end
$$;

create function public.pg_give_notice(p_stay_id uuid, p_notice_on date, p_planned_move_out date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
begin
  if v_stay.status <> 'ACTIVE' then
    raise exception 'Notice can only be given while living here' using errcode = '23514';
  end if;
  if p_notice_on is null or p_notice_on > private.today_ist() or p_notice_on < v_stay.start_date then
    raise exception 'Notice date is not valid' using errcode = '22023';
  end if;
  if p_planned_move_out is null or p_planned_move_out < p_notice_on then
    raise exception 'Move-out date must be on or after the notice date' using errcode = '22023';
  end if;
  update public.pg_stays
  set status = 'NOTICE', notice_given_on = p_notice_on, planned_move_out = p_planned_move_out
  where id = v_stay.id;
end
$$;

create function public.pg_withdraw_notice(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
begin
  if v_stay.status <> 'NOTICE' then
    raise exception 'No notice to withdraw' using errcode = '23514';
  end if;
  update public.pg_stays
  set status = 'ACTIVE', notice_given_on = null, planned_move_out = null
  where id = v_stay.id;
end
$$;

-- Move-out (owner only). Optional deductions are added as CHARGE
-- adjustments in the same transaction. Returns the final amount:
-- positive = collect from the resident, negative = refund owed.
create function public.pg_settle_move_out(p_stay_id uuid, p_moved_out_on date, p_deductions jsonb default '[]')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
  d jsonb;
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can settle a move-out' using errcode = '42501';
  end if;
  if v_stay.status not in ('ACTIVE', 'NOTICE') then
    raise exception 'This resident has already moved out' using errcode = '23514';
  end if;
  if p_moved_out_on is null or p_moved_out_on < v_stay.start_date or p_moved_out_on > private.today_ist() then
    raise exception 'Move-out date is not valid' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_deductions, '[]')) <> 'array' or jsonb_array_length(coalesce(p_deductions, '[]')) > 10 then
    raise exception 'Too many deductions' using errcode = '22023';
  end if;
  for d in select * from jsonb_array_elements(coalesce(p_deductions, '[]')) loop
    insert into public.pg_stay_adjustments (tenant_id, stay_id, kind, amount_paise, reason, on_date)
    values (v_stay.tenant_id, v_stay.id, 'CHARGE', (d ->> 'amount_paise')::bigint,
            trim(d ->> 'reason'), p_moved_out_on);
  end loop;
  update public.pg_stays
  set status = 'MOVED_OUT', moved_out_on = p_moved_out_on, settled_by = auth.uid()
  where id = v_stay.id;
  return private.pg_stay_final_paise(v_stay.id);
end
$$;

-- Moved in by mistake: owner only, and only with no money recorded.
create function public.pg_cancel_stay(p_stay_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay public.pg_stays%rowtype := private.pg_lock_stay(p_stay_id);
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can cancel a stay' using errcode = '42501';
  end if;
  if v_stay.status not in ('ACTIVE', 'NOTICE') then
    raise exception 'This stay can''t be cancelled' using errcode = '23514';
  end if;
  if exists (select 1 from public.pg_payments where stay_id = v_stay.id) then
    raise exception 'Payments are recorded: use move-out instead' using errcode = '23514';
  end if;
  update public.pg_stays set status = 'CANCELLED', cancelled_at = now() where id = v_stay.id;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pg_move_in(uuid, uuid, uuid, date, uuid, bigint, bigint)',
    'public.pg_change_rates(uuid, date, bigint, uuid, bigint)',
    'public.pg_add_adjustment(uuid, public.pg_adjustment_kind, bigint, text)',
    'public.pg_give_notice(uuid, date, date)',
    'public.pg_withdraw_notice(uuid)',
    'public.pg_settle_move_out(uuid, date, jsonb)',
    'public.pg_cancel_stay(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Messages for residents (one-tap, logged like booking messages)
-- ---------------------------------------------------------------------------

alter type public.message_type add value 'RENT_DUE';
alter type public.message_type add value 'PAYMENT_RECEIPT';

alter table public.message_log alter column rental_order_id drop not null;
alter table public.message_log add column pg_stay_id uuid;
alter table public.message_log
  add constraint message_log_stay_fkey foreign key (tenant_id, pg_stay_id)
    references public.pg_stays (tenant_id, id) on delete restrict,
  add constraint message_log_one_subject check (num_nonnulls(rental_order_id, pg_stay_id) = 1);
create index message_log_stay_idx on public.message_log (tenant_id, pg_stay_id, opened_at desc)
  where pg_stay_id is not null;
