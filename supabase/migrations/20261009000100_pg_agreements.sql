-- Phase 14: rent agreements & renewals (hostel / PG).
--
-- One ACTIVE agreement per stay: start, end (start + N months − 1 day),
-- optional lock-in, and the yearly rent increase % used to suggest the
-- renewal rent. Renewing chains a new ACTIVE agreement after the old one
-- (old → RENEWED) and, if the owner sets a new rent, adds a rate row from
-- the first due date in the new term that is still in the future (the
-- phase 13 rule: rates never change for months already due). The signed
-- agreement (PDF or photo) lives in the private bucket under
-- <tenant>/<customer>/agreements/. Writes only through the functions below.

-- ---------------------------------------------------------------------------
-- Defaults (Hostel setup)
-- ---------------------------------------------------------------------------
alter table public.pg_settings
  add column agreement_months integer not null default 11 check (agreement_months between 1 and 60),
  add column lock_in_months integer not null default 0 check (lock_in_months between 0 and 24),
  add column rent_increase_pct numeric(5, 2) not null default 5 check (rent_increase_pct between 0 and 50),
  add column agreement_alert_days integer not null default 30 check (agreement_alert_days between 0 and 120);

-- ---------------------------------------------------------------------------
-- Agreements
-- ---------------------------------------------------------------------------
create type public.pg_agreement_status as enum ('ACTIVE', 'RENEWED', 'ENDED');

create table public.pg_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  stay_id uuid not null,
  start_date date not null,
  end_date date not null,
  lock_in_until date,
  rent_increase_pct numeric(5, 2) not null default 0 check (rent_increase_pct between 0 and 50),
  status public.pg_agreement_status not null default 'ACTIVE',
  -- NO ACTION (checked at statement end) so a whole chain can be deleted at once.
  renewed_from uuid references public.pg_agreements (id),
  document_path text check (document_path is null or length(document_path) <= 200),
  document_type text check (document_type is null
    or document_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  document_size integer check (document_size is null or document_size between 1 and 5242880),
  document_uploaded_at timestamptz,
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, stay_id) references public.pg_stays (tenant_id, id) on delete restrict,
  check (end_date >= start_date),
  check (lock_in_until is null or (lock_in_until >= start_date and lock_in_until <= end_date)),
  check ((document_path is null) = (document_type is null))
);
create unique index pg_agreements_one_active on public.pg_agreements (stay_id) where status = 'ACTIVE';
create index pg_agreements_tenant_end_idx on public.pg_agreements (tenant_id, status, end_date);

create trigger pg_agreements_updated_at before update on public.pg_agreements
  for each row execute function private.set_updated_at();

alter table public.pg_agreements enable row level security;
revoke all on public.pg_agreements from anon;
revoke insert, update, delete, truncate on public.pg_agreements from authenticated;
create policy "pg_agreements: members read own business" on public.pg_agreements
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));

-- A stay that ends (moved out / cancelled) ends its agreement.
create function private.end_agreement_with_stay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('MOVED_OUT', 'CANCELLED') and old.status is distinct from new.status then
    update public.pg_agreements set status = 'ENDED'
    where stay_id = new.id and status = 'ACTIVE';
  end if;
  return new;
end
$$;
create trigger pg_stays_end_agreement after update of status on public.pg_stays
  for each row execute function private.end_agreement_with_stay();

-- Locked ACTIVE agreement of the caller's PG, or an error.
create function private.pg_lock_agreement(p_agreement_id uuid)
returns public.pg_agreements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.writable_pg_tenant_id();
  v_a public.pg_agreements%rowtype;
begin
  if v_tenant is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v_a from public.pg_agreements
  where id = p_agreement_id and tenant_id = v_tenant for update;
  if not found then raise exception 'Agreement not found' using errcode = '23503'; end if;
  if v_a.status <> 'ACTIVE' then
    raise exception 'This agreement is no longer current' using errcode = '23514';
  end if;
  return v_a;
end
$$;
revoke all on function private.pg_lock_agreement(uuid) from public;

create function public.pg_create_agreement(
  p_stay_id uuid,
  p_start date,
  p_months integer,
  p_lock_in_months integer default 0,
  p_increase_pct numeric default 0
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
  if v_stay.status not in ('ACTIVE', 'NOTICE') then
    raise exception 'This resident has moved out' using errcode = '23514';
  end if;
  if p_months is null or p_months < 1 or p_months > 60 then
    raise exception 'An agreement runs 1 to 60 months' using errcode = '22023';
  end if;
  if coalesce(p_lock_in_months, 0) < 0 or coalesce(p_lock_in_months, 0) > least(24, p_months) then
    raise exception 'Lock-in must be shorter than the agreement' using errcode = '22023';
  end if;
  if p_start is null or p_start < v_stay.start_date - 366 or p_start > private.today_ist() + 366 then
    raise exception 'Agreement start date is not valid' using errcode = '22023';
  end if;
  if exists (select 1 from public.pg_agreements where stay_id = v_stay.id and status = 'ACTIVE') then
    raise exception 'This resident already has a current agreement' using errcode = '23505';
  end if;
  insert into public.pg_agreements
    (tenant_id, stay_id, start_date, end_date, lock_in_until, rent_increase_pct)
  values (
    v_stay.tenant_id, v_stay.id, p_start,
    ((p_start + make_interval(months => p_months))::date - 1),
    case when coalesce(p_lock_in_months, 0) > 0
         then ((p_start + make_interval(months => p_lock_in_months))::date - 1) end,
    coalesce(p_increase_pct, 0)
  )
  returning id into v_id;
  return v_id;
end
$$;

create function public.pg_update_agreement(
  p_agreement_id uuid,
  p_end date,
  p_lock_in_until date,
  p_increase_pct numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.pg_agreements%rowtype := private.pg_lock_agreement(p_agreement_id);
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can change an agreement' using errcode = '42501';
  end if;
  if p_end is null or p_end < v_a.start_date then
    raise exception 'End date must be on or after the start date' using errcode = '22023';
  end if;
  if p_lock_in_until is not null and (p_lock_in_until < v_a.start_date or p_lock_in_until > p_end) then
    raise exception 'Lock-in must end within the agreement' using errcode = '22023';
  end if;
  if p_increase_pct is null or p_increase_pct < 0 or p_increase_pct > 50 then
    raise exception 'Increase must be 0 to 50%%' using errcode = '22023';
  end if;
  update public.pg_agreements
  set end_date = p_end, lock_in_until = p_lock_in_until, rent_increase_pct = p_increase_pct
  where id = v_a.id;
end
$$;

-- Renew: new term after the old one; optional new rent from the first due
-- date in the new term that is after today. Returns the new agreement id.
create function public.pg_renew_agreement(
  p_agreement_id uuid,
  p_months integer,
  p_new_rent_paise bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.pg_agreements%rowtype := private.pg_lock_agreement(p_agreement_id);
  v_stay public.pg_stays%rowtype;
  v_start date;
  v_from date;
  v_rate public.pg_stay_rates%rowtype;
  v_id uuid;
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can renew an agreement' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 60 then
    raise exception 'An agreement runs 1 to 60 months' using errcode = '22023';
  end if;
  select * into v_stay from public.pg_stays where id = v_a.stay_id for update;
  if v_stay.status not in ('ACTIVE', 'NOTICE') then
    raise exception 'This resident has moved out' using errcode = '23514';
  end if;
  if p_new_rent_paise is not null and (p_new_rent_paise < 0 or p_new_rent_paise > 100000000) then
    raise exception 'Enter a valid rent' using errcode = '22023';
  end if;

  v_start := v_a.end_date + 1;
  update public.pg_agreements set status = 'RENEWED' where id = v_a.id;
  insert into public.pg_agreements
    (tenant_id, stay_id, start_date, end_date, lock_in_until, rent_increase_pct, renewed_from)
  values (v_a.tenant_id, v_a.stay_id, v_start,
          ((v_start + make_interval(months => p_months))::date - 1),
          null, v_a.rent_increase_pct, v_a.id)
  returning id into v_id;

  if p_new_rent_paise is not null then
    -- First due date on or after the new start that is still in the future.
    select (v_stay.start_date + make_interval(months => k))::date into v_from
    from generate_series(1, 1200) k
    where (v_stay.start_date + make_interval(months => k))::date >= v_start
      and (v_stay.start_date + make_interval(months => k))::date > private.today_ist()
    order by k
    limit 1;
    select * into v_rate from public.pg_stay_rates
    where stay_id = v_stay.id and effective_from <= v_from
    order by effective_from desc limit 1;
    if v_rate.rent_paise is distinct from p_new_rent_paise then
      insert into public.pg_stay_rates
        (tenant_id, stay_id, effective_from, rent_paise, meal_plan_id, meal_plan_name, meal_paise, electricity_paise)
      values (v_stay.tenant_id, v_stay.id, v_from, p_new_rent_paise,
              v_rate.meal_plan_id, v_rate.meal_plan_name, coalesce(v_rate.meal_paise, 0),
              coalesce(v_rate.electricity_paise, 0))
      on conflict (stay_id, effective_from) do update
        set rent_paise = excluded.rent_paise, created_by = auth.uid(), created_at = now();
    end if;
  end if;
  return v_id;
end
$$;

-- Attach / replace the signed agreement file (owner only).
create function public.pg_set_agreement_document(
  p_agreement_id uuid,
  p_path text,
  p_type text,
  p_size integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.pg_agreements%rowtype := private.pg_lock_agreement(p_agreement_id);
  v_customer uuid;
  v_old text := v_a.document_path;
begin
  if private.current_app_role() <> 'ADMIN' then
    raise exception 'Only the owner can attach the agreement' using errcode = '42501';
  end if;
  select customer_id into v_customer from public.pg_stays where id = v_a.stay_id;
  if p_path is null
     or p_path not like v_a.tenant_id::text || '/' || v_customer::text || '/agreements/%' then
    raise exception 'File is not in this resident''s folder' using errcode = '23514';
  end if;
  update public.pg_agreements
  set document_path = p_path, document_type = p_type, document_size = p_size,
      document_uploaded_at = now()
  where id = v_a.id;
  return v_old; -- the replaced file, for the app to delete
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pg_create_agreement(uuid, date, integer, integer, numeric)',
    'public.pg_update_agreement(uuid, date, date, numeric)',
    'public.pg_renew_agreement(uuid, integer, bigint)',
    'public.pg_set_agreement_document(uuid, text, text, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage: agreement PDFs (up to 5 MB) in the same private bucket.
-- ID photos keep their 2 MB limit (app + pg_id_documents check).
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'resident-ids';

-- ---------------------------------------------------------------------------
-- Renewal message
-- ---------------------------------------------------------------------------
alter type public.message_type add value 'AGREEMENT_RENEWAL';

-- ---------------------------------------------------------------------------
-- delete_test_business: + agreements
-- ---------------------------------------------------------------------------
create or replace function public.delete_test_business(p_tenant_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_users uuid[];
  v_counts jsonb;
  v_secret uuid;
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
              + (select count(*) from public.pg_payments where tenant_id = p_tenant_id),
    'rooms', (select count(*) from public.pg_rooms where tenant_id = p_tenant_id),
    'stays', (select count(*) from public.pg_stays where tenant_id = p_tenant_id)
  );

  select vault_secret_id into v_secret from private.whatsapp_credentials where tenant_id = p_tenant_id;

  -- Children first (foreign keys are ON DELETE RESTRICT on purpose).
  delete from public.message_log           where tenant_id = p_tenant_id;
  delete from public.pg_complaints         where tenant_id = p_tenant_id;
  delete from public.pg_id_documents       where tenant_id = p_tenant_id;
  delete from public.pg_payments           where tenant_id = p_tenant_id and kind = 'REVERSAL';
  delete from public.pg_payments           where tenant_id = p_tenant_id;
  delete from public.pg_agreements         where tenant_id = p_tenant_id;
  delete from public.pg_stay_adjustments   where tenant_id = p_tenant_id;
  delete from public.pg_stay_rates         where tenant_id = p_tenant_id;
  delete from public.pg_stays              where tenant_id = p_tenant_id;
  delete from public.pg_resident_details   where tenant_id = p_tenant_id;
  delete from public.pg_beds               where tenant_id = p_tenant_id;
  delete from public.pg_rooms              where tenant_id = p_tenant_id;
  delete from public.pg_meal_plans         where tenant_id = p_tenant_id;
  delete from public.pg_settings           where tenant_id = p_tenant_id;
  delete from public.rental_returns        where tenant_id = p_tenant_id;
  delete from public.rental_payments       where tenant_id = p_tenant_id and kind = 'REVERSAL';
  delete from public.rental_payments       where tenant_id = p_tenant_id;
  delete from public.rental_order_items    where tenant_id = p_tenant_id;
  delete from public.rental_orders         where tenant_id = p_tenant_id;
  delete from private.booking_counters     where tenant_id = p_tenant_id;
  delete from public.rental_customers      where tenant_id = p_tenant_id;
  delete from public.rental_items          where tenant_id = p_tenant_id;
  delete from public.message_templates     where tenant_id = p_tenant_id;
  delete from public.whatsapp_settings     where tenant_id = p_tenant_id;
  delete from public.whatsapp_connections  where tenant_id = p_tenant_id;
  delete from private.whatsapp_credentials where tenant_id = p_tenant_id;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
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

