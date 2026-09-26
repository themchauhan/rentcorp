-- Phase 1b: row-level security for tenants, profiles, platform_admins,
-- audit_logs. No DELETE is possible on any of them (soft-delete only).

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_logs enable row level security;

-- Signed-out visitors get nothing; nobody deletes or truncates.
revoke all on public.tenants, public.profiles, public.platform_admins, public.audit_logs from anon;
revoke delete, truncate on public.tenants, public.profiles, public.platform_admins, public.audit_logs
  from authenticated;
-- Audit log is append-only; platform_admins is managed server-side only.
revoke update on public.audit_logs from authenticated;
revoke insert, update on public.platform_admins from authenticated;

-- tenants --------------------------------------------------------------------
create policy "tenants: members read own tenant, platform admins read all"
  on public.tenants for select to authenticated
  using (id = (select private.current_tenant_id()) or (select private.is_platform_admin()));

create policy "tenants: platform admins insert"
  on public.tenants for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy "tenants: platform admins update"
  on public.tenants for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- profiles -------------------------------------------------------------------
-- Own row is always readable (even if INACTIVE) so the app can explain why
-- access is blocked. Team members of the same tenant are readable.
create policy "profiles: read own row, same-tenant members, or all as platform admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or tenant_id = (select private.current_tenant_id())
    or (select private.is_platform_admin())
  );

-- Profiles are created server-side (Phase 1c). Only platform admins may
-- update them for now; ADMIN-managed staff changes arrive in Phase 1c.
create policy "profiles: platform admins update"
  on public.profiles for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- platform_admins --------------------------------------------------------------
create policy "platform_admins: read own row"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_logs -----------------------------------------------------------------
create policy "audit_logs: tenant ADMIN reads own tenant, platform admins read all"
  on public.audit_logs for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.current_tenant_id())
      and (select private.current_app_role()) = 'ADMIN'
    )
  );

-- Actor and tenant are forced by the audit_logs_force_actor trigger; this
-- check is the backstop (and blocks INACTIVE users, whose tenant is NULL).
create policy "audit_logs: signed-in users append for themselves"
  on public.audit_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      tenant_id = (select private.current_tenant_id())
      or (select private.is_platform_admin())
    )
  );
