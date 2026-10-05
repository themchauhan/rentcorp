-- WhatsApp automation is an optional add-on. Off by default: businesses
-- without it see only the one-tap Send on WhatsApp / SMS buttons. Only the
-- super admin can switch it (existing "tenants: platform admins update"
-- policy). Turning it off keeps any saved connection.
alter table public.tenants add column whatsapp_addon boolean not null default false;
