-- Phase 5: message wording per business, and a log of every
-- send/copy tap. The app never sends messages itself: it opens WhatsApp or
-- the SMS app on the user's phone, so the log records "opened", never
-- "delivered".

create type public.message_type as enum ('BOOKING_CONFIRMATION', 'AMOUNT_DUE', 'RETURN_CONFIRMATION');
create type public.message_log_channel as enum ('WHATSAPP', 'SMS', 'COPY');

-- Optional per-business wording. No row = the app's default wording.
create table public.message_templates (
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  message_type public.message_type not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  updated_by uuid references auth.users (id) on delete restrict default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, message_type)
);

create trigger message_templates_force_tenant_id before insert or update on public.message_templates
  for each row execute function private.force_tenant_id();

create function private.stamp_template_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.updated_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger message_templates_stamp before insert or update on public.message_templates
  for each row execute function private.stamp_template_author();

create table public.message_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  rental_order_id uuid not null,
  message_type public.message_type not null,
  channel public.message_log_channel not null,
  -- 10-digit number the message was addressed to (NULL for Copy).
  to_number text check (to_number ~ '^[6-9][0-9]{9}$'),
  body_snapshot text not null check (length(body_snapshot) between 1 and 5000),
  amount_due_snapshot_paise bigint,
  sent_by uuid references auth.users (id) on delete restrict default auth.uid(),
  opened_at timestamptz not null default now(),
  foreign key (tenant_id, rental_order_id)
    references public.rental_orders (tenant_id, id) on delete restrict,
  check ((channel = 'COPY') = (to_number is null))
);
create index message_log_order_idx on public.message_log (tenant_id, rental_order_id, opened_at desc);

create trigger message_log_force_tenant_id before insert on public.message_log
  for each row execute function private.force_tenant_id();

-- Sender and time always come from the session / server clock.
create function private.stamp_message_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    new.sent_by := (select auth.uid());
    new.opened_at := now();
  end if;
  return new;
end
$$;
create trigger message_log_stamp before insert on public.message_log
  for each row execute function private.stamp_message_log();

alter table public.message_templates enable row level security;
alter table public.message_log enable row level security;

revoke all on public.message_templates, public.message_log from anon;
revoke delete, truncate on public.message_templates, public.message_log from authenticated;
revoke update on public.message_log from authenticated;

create policy "message_templates: members read own business"
  on public.message_templates for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "message_templates: owners add"
  on public.message_templates for insert to authenticated
  with check (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  );
create policy "message_templates: owners edit"
  on public.message_templates for update to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  )
  with check (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  );

create policy "message_log: members read own business"
  on public.message_log for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "message_log: members append for own business"
  on public.message_log for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));
