-- Phase 13c/d: ID proof photos (private Storage) and maintenance complaints.
-- Also extends delete_test_business() to the PG tables (and the WhatsApp
-- tables, which it previously missed).

-- ---------------------------------------------------------------------------
-- ID proof photos
-- ---------------------------------------------------------------------------
-- Files live in the private bucket "resident-ids" at
--   <tenant_id>/<customer_id>/<uuid>.<ext>
-- Only members of that business can read them (through the app's route,
-- never a public URL). The full ID number is never stored. On request the
-- owner removes a photo: the file is deleted permanently and this row is
-- kept, marked removed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resident-ids', 'resident-ids', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "resident-ids: members read own business"
  on storage.objects for select to authenticated
  using (bucket_id = 'resident-ids'
         and (storage.foldername(name))[1] = (select private.current_tenant_id())::text);
create policy "resident-ids: members upload to own PG"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resident-ids'
              and (storage.foldername(name))[1] = (select private.writable_pg_tenant_id())::text);
-- Removal is a privacy right: allowed for the owner even when read-only.
create policy "resident-ids: owners remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resident-ids'
         and (storage.foldername(name))[1] = (select private.current_tenant_id())::text
         and (select private.current_app_role()) = 'ADMIN');

create type public.pg_id_side as enum ('FRONT', 'BACK', 'OTHER');

create table public.pg_id_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  customer_id uuid not null,
  doc_type public.pg_id_type not null,
  side public.pg_id_side not null default 'FRONT',
  storage_path text not null unique check (length(storage_path) <= 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid references auth.users (id) on delete restrict default auth.uid(),
  uploaded_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.rental_customers (tenant_id, id) on delete restrict
);
create index pg_id_documents_customer_idx on public.pg_id_documents (tenant_id, customer_id);

create trigger pg_id_documents_force_tenant_id before insert or update on public.pg_id_documents
  for each row execute function private.force_tenant_id();

create function private.check_id_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.storage_path not like new.tenant_id::text || '/' || new.customer_id::text || '/%' then
      raise exception 'File is not in this resident''s folder' using errcode = '23514';
    end if;
    if (select auth.role()) = 'authenticated' then
      new.uploaded_by := (select auth.uid());
      new.uploaded_at := now();
      new.removed_at := null;
      new.removed_by := null;
    end if;
  else
    -- Only "mark removed", once.
    if old.removed_at is not null or new.removed_at is null
       or (new.customer_id, new.doc_type, new.side, new.storage_path, new.content_type, new.size_bytes,
           new.uploaded_by, new.uploaded_at)
          is distinct from
          (old.customer_id, old.doc_type, old.side, old.storage_path, old.content_type, old.size_bytes,
           old.uploaded_by, old.uploaded_at) then
      raise exception 'ID documents can only be marked removed' using errcode = '23514';
    end if;
    if (select auth.role()) = 'authenticated' then
      new.removed_by := (select auth.uid());
      new.removed_at := now();
    end if;
  end if;
  return new;
end
$$;
create trigger pg_id_documents_check before insert or update on public.pg_id_documents
  for each row execute function private.check_id_document();

alter table public.pg_id_documents enable row level security;
revoke all on public.pg_id_documents from anon;
revoke delete, truncate on public.pg_id_documents from authenticated;
create policy "pg_id_documents: members read own business" on public.pg_id_documents
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_id_documents: members add to own PG" on public.pg_id_documents
  for insert to authenticated with check (tenant_id = (select private.writable_pg_tenant_id()));
create policy "pg_id_documents: owners mark removed" on public.pg_id_documents
  for update to authenticated
  using (tenant_id = (select private.current_tenant_id())
         and (select private.current_app_role()) = 'ADMIN')
  with check (tenant_id = (select private.current_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');

-- ---------------------------------------------------------------------------
-- Maintenance complaints
-- ---------------------------------------------------------------------------

create type public.pg_complaint_category as enum
  ('ELECTRICAL', 'PLUMBING', 'CLEANING', 'FURNITURE', 'WIFI', 'FOOD', 'OTHER');
create type public.pg_complaint_priority as enum ('NORMAL', 'URGENT');
create type public.pg_complaint_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED');

create table public.pg_complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  -- Room is optional (common areas); the stay is optional (who raised it).
  room_id uuid,
  stay_id uuid,
  category public.pg_complaint_category not null,
  priority public.pg_complaint_priority not null default 'NORMAL',
  description text not null check (length(trim(description)) between 2 and 1000),
  status public.pg_complaint_status not null default 'OPEN',
  resolution_note text check (resolution_note is null or length(resolution_note) <= 500),
  raised_by uuid references auth.users (id) on delete restrict default auth.uid(),
  raised_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete restrict,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, room_id) references public.pg_rooms (tenant_id, id) on delete restrict,
  foreign key (tenant_id, stay_id) references public.pg_stays (tenant_id, id) on delete restrict
);
create index pg_complaints_tenant_status_idx on public.pg_complaints (tenant_id, status, raised_at desc);

create trigger pg_complaints_force_tenant_id before insert or update on public.pg_complaints
  for each row execute function private.force_tenant_id();
create trigger pg_complaints_updated_at before update on public.pg_complaints
  for each row execute function private.set_updated_at();

create function private.stamp_complaint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stay_id is not null then
    select room_id into new.room_id from public.pg_stays
    where id = new.stay_id and tenant_id = new.tenant_id;
  end if;
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      new.raised_by := (select auth.uid());
      new.raised_at := now();
      new.status := 'OPEN';
    else
      new.raised_by := old.raised_by;
      new.raised_at := old.raised_at;
      new.category := old.category;
      new.description := old.description;
      new.stay_id := old.stay_id;
      new.room_id := old.room_id;
    end if;
  end if;
  if new.status = 'RESOLVED' then
    if tg_op = 'INSERT' or old.status <> 'RESOLVED' then
      new.resolved_by := (select auth.uid());
      new.resolved_at := now();
    end if;
  else
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end
$$;
create trigger pg_complaints_stamp before insert or update on public.pg_complaints
  for each row execute function private.stamp_complaint();

alter table public.pg_complaints enable row level security;
revoke all on public.pg_complaints from anon;
revoke delete, truncate on public.pg_complaints from authenticated;
create policy "pg_complaints: members read own business" on public.pg_complaints
  for select to authenticated using (tenant_id = (select private.current_tenant_id()));
create policy "pg_complaints: members add to own PG" on public.pg_complaints
  for insert to authenticated with check (tenant_id = (select private.writable_pg_tenant_id()));
create policy "pg_complaints: members update own PG" on public.pg_complaints
  for update to authenticated
  using (tenant_id = (select private.writable_pg_tenant_id()))
  with check (tenant_id = (select private.writable_pg_tenant_id()));

-- ---------------------------------------------------------------------------
-- delete_test_business: + PG tables, + WhatsApp tables
-- ---------------------------------------------------------------------------
-- Storage files can't be removed from SQL; the server action deletes the
-- business's "resident-ids" files through the Storage API first.

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
