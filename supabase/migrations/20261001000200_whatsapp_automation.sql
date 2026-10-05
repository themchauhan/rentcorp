-- WhatsApp automation (step 3): per-business automation settings, the
-- once-per-day guard for the 9 PM reminder, and a record of each job run.

-- A reminder row is "claimed" (PENDING) before Meta is called, so a retried
-- or double-fired job can never send twice.
alter type public.whatsapp_delivery_status add value if not exists 'PENDING';

-- The evening reminder's day (IST). NULL for messages sent any other way.
alter table public.message_log add column reminder_date date;
create unique index message_log_reminder_once
  on public.message_log (rental_order_id, reminder_date)
  where channel = 'WHATSAPP_API' and reminder_date is not null;

-- ---------------------------------------------------------------------------
-- Automation settings (owner). No row = both on.
-- ---------------------------------------------------------------------------
create table public.whatsapp_settings (
  tenant_id uuid primary key default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  auto_booking_details boolean not null default true,
  evening_reminder boolean not null default true,
  updated_by uuid references auth.users (id) on delete restrict default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger whatsapp_settings_force_tenant_id before insert or update on public.whatsapp_settings
  for each row execute function private.force_tenant_id();
create trigger whatsapp_settings_stamp before insert or update on public.whatsapp_settings
  for each row execute function private.stamp_template_author();

alter table public.whatsapp_settings enable row level security;
revoke all on public.whatsapp_settings from anon;
revoke delete, truncate on public.whatsapp_settings from authenticated;

create policy "whatsapp_settings: members read own business"
  on public.whatsapp_settings for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));
create policy "whatsapp_settings: owners add"
  on public.whatsapp_settings for insert to authenticated
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');
create policy "whatsapp_settings: owners edit"
  on public.whatsapp_settings for update to authenticated
  using (tenant_id = (select private.current_writable_tenant_id())
         and (select private.current_app_role()) = 'ADMIN')
  with check (tenant_id = (select private.current_writable_tenant_id())
              and (select private.current_app_role()) = 'ADMIN');

-- ---------------------------------------------------------------------------
-- Scheduled job runs (written by the server; read by the super admin)
-- ---------------------------------------------------------------------------
create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  run_date date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  businesses integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);
create index job_runs_job_started_idx on public.job_runs (job, started_at desc);

alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon;
revoke insert, update, delete, truncate on public.job_runs from authenticated;
create policy "job_runs: platform admins read"
  on public.job_runs for select to authenticated
  using ((select private.is_platform_admin()));
