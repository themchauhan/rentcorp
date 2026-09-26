-- Phase 2: item catalog. Owners (ADMIN) manage items; every active member
-- of the business can read them. Items are never deleted, only deactivated.
-- Money is stored in integer paise (project rule 8).

create type public.rate_unit as enum ('PER_DAY', 'PER_EVENT');

create table public.rental_items (
  id uuid primary key default gen_random_uuid(),
  -- Filled from the session (and enforced by the force_tenant_id trigger), so
  -- the app never sends it.
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (length(trim(category)) between 1 and 60),
  unit_label text not null default 'piece' check (length(trim(unit_label)) between 1 and 30),
  total_quantity_owned integer not null check (total_quantity_owned >= 0),
  -- ₹0 to ₹1 crore per unit.
  rate_paise bigint not null check (rate_paise between 0 and 1000000000),
  rate_unit public.rate_unit not null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One item per name per business ("Chair" and " chair" clash).
create unique index rental_items_tenant_name_key
  on public.rental_items (tenant_id, lower(trim(name)));
create index rental_items_tenant_active_category_idx
  on public.rental_items (tenant_id, active, category);

create trigger rental_items_force_tenant_id before insert or update on public.rental_items
  for each row execute function private.force_tenant_id();
create trigger rental_items_updated_at before update on public.rental_items
  for each row execute function private.set_updated_at();

alter table public.rental_items enable row level security;

revoke all on public.rental_items from anon;
revoke delete, truncate on public.rental_items from authenticated;

create policy "rental_items: members read own business"
  on public.rental_items for select to authenticated
  using (tenant_id = (select private.current_tenant_id()));

create policy "rental_items: owners add to own business"
  on public.rental_items for insert to authenticated
  with check (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  );

create policy "rental_items: owners edit own business"
  on public.rental_items for update to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  )
  with check (
    tenant_id = (select private.current_tenant_id())
    and (select private.current_app_role()) = 'ADMIN'
  );
