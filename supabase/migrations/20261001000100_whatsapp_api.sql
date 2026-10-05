-- WhatsApp Cloud API (step 2): each business connects its own WhatsApp
-- Business number; the server sends Meta-approved templates and records
-- real delivery status from Meta's webhook.
--
--  * Access tokens live in Supabase Vault. Only service_role can store or
--    read them (two functions below); they never appear in any table the
--    app or users can read.
--  * Members of a business can see whether it is connected, never the token.
--  * Delivery status is written only by the webhook (service role).
--  * Automatic messages go only to customers who agreed to receive them.

create type public.whatsapp_connection_status as enum ('CONNECTED', 'DISCONNECTED');
create type public.whatsapp_delivery_status as enum ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- ---------------------------------------------------------------------------
-- Connections (one per business)
-- ---------------------------------------------------------------------------
create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete restrict,
  waba_id text not null check (waba_id ~ '^[0-9]{5,30}$'),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone_number text not null check (length(display_phone_number) between 5 and 30),
  status public.whatsapp_connection_status not null default 'CONNECTED',
  connected_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger whatsapp_connections_updated_at before update on public.whatsapp_connections
  for each row execute function private.set_updated_at();

alter table public.whatsapp_connections enable row level security;
revoke all on public.whatsapp_connections from anon;
revoke insert, update, delete, truncate on public.whatsapp_connections from authenticated;

create policy "whatsapp_connections: members read own business, platform admins all"
  on public.whatsapp_connections for select to authenticated
  using (tenant_id = (select private.current_tenant_id()) or (select private.is_platform_admin()));

-- Token reference only (the secret itself is encrypted in vault.secrets).
create table private.whatsapp_credentials (
  tenant_id uuid primary key references public.tenants (id) on delete restrict,
  vault_secret_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table private.whatsapp_credentials enable row level security;

-- Store/replace a business's access token. service_role only.
create function public.wa_set_credentials(p_tenant_id uuid, p_access_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  if length(coalesce(p_access_token, '')) < 20 then
    raise exception 'Access token looks too short' using errcode = '22023';
  end if;
  select vault_secret_id into v_secret from private.whatsapp_credentials where tenant_id = p_tenant_id;
  if v_secret is null then
    v_secret := vault.create_secret(p_access_token, 'whatsapp_token_' || p_tenant_id::text,
                                    'WhatsApp Cloud API access token');
    insert into private.whatsapp_credentials (tenant_id, vault_secret_id) values (p_tenant_id, v_secret);
  else
    perform vault.update_secret(v_secret, p_access_token);
    update private.whatsapp_credentials set updated_at = now() where tenant_id = p_tenant_id;
  end if;
end
$$;

-- Read a business's access token (decrypted). service_role only.
create function public.wa_access_token(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from private.whatsapp_credentials c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.tenant_id = p_tenant_id
$$;

revoke all on function public.wa_set_credentials(uuid, text) from public, anon, authenticated;
revoke all on function public.wa_access_token(uuid) from public, anon, authenticated;
grant execute on function public.wa_set_credentials(uuid, text) to service_role;
grant execute on function public.wa_access_token(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Message log: API sends with real delivery status
-- ---------------------------------------------------------------------------
alter type public.message_log_channel add value if not exists 'WHATSAPP_API';

alter table public.message_log
  add column template_name text check (length(template_name) <= 100),
  add column provider_message_id text unique check (length(provider_message_id) <= 200),
  add column delivery_status public.whatsapp_delivery_status,
  add column status_updated_at timestamptz,
  add column error_code text check (length(error_code) <= 50),
  add column error_message text check (length(error_message) <= 500);

-- ---------------------------------------------------------------------------
-- Customer consent for WhatsApp messages from the business
-- ---------------------------------------------------------------------------
alter table public.rental_customers
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_opt_in_at timestamptz,
  add column whatsapp_opted_out_at timestamptz;

create function private.stamp_whatsapp_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.whatsapp_opt_in then new.whatsapp_opt_in_at := now(); end if;
  elsif new.whatsapp_opt_in is distinct from old.whatsapp_opt_in then
    if new.whatsapp_opt_in then
      new.whatsapp_opt_in_at := now();
      new.whatsapp_opted_out_at := null;
    else
      new.whatsapp_opted_out_at := now();
    end if;
  end if;
  return new;
end
$$;
create trigger rental_customers_whatsapp_consent before insert or update on public.rental_customers
  for each row execute function private.stamp_whatsapp_consent();

-- API-send rows (and their delivery fields) are written only by the server
-- (service role), so a signed-in user can't log a fake "delivered" send.
create function private.guard_api_log_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and (new.channel = 'WHATSAPP_API' or new.provider_message_id is not null
          or new.delivery_status is not null or new.template_name is not null) then
    raise exception 'Only the server records WhatsApp API sends' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger message_log_guard_api_rows before insert on public.message_log
  for each row execute function private.guard_api_log_rows();
