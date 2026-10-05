-- LOCAL DEVELOPMENT SEED — dummy data only, never real people or numbers.
--
-- Every seeded login uses the password:  Demo@1234
-- Log in with the mobile number below (the app maps it to the internal
-- login email 91<mobile>@mobile.invalid).
--
-- | Mobile     | Who                               | Tenant             |
-- |------------|-----------------------------------|--------------------|
-- | 9000000001 | Super admin (platform)            | —                  |
-- | 9000000101 | Admin (owner)                     | Demo Tent House A  |
-- | 9000000102 | Staff                             | Demo Tent House A  |
-- | 9000000103 | Staff, INACTIVE (cannot log in)   | Demo Tent House A  |
-- | 9000000104 | Staff (used by the change-password e2e test) | Demo Tent House A |
-- | 9000000201 | Admin (owner)                     | Demo Tent House B  |
-- | 9000000202 | Staff                             | Demo Tent House B  |
-- | 9000000301 | Admin of a SUSPENDED tenant       | Demo Tent House C  |

insert into public.tenants (id, name, phone, email, status, plan, trial_ends_at, subscription_ends_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Tent House A', '9000000100', 'a@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Demo Tent House B', '9000000200', 'b@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Demo Tent House C', '9000000300', 'c@example.test', 'SUSPENDED', 'STANDARD', null, now() - interval '10 days');

-- Auth users. Token columns must be '' (not NULL) for Supabase Auth.
with seed_users (id, mobile) as (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, '9000000001'),
    ('a0000000-0000-4000-8000-000000000001'::uuid, '9000000101'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, '9000000102'),
    ('a0000000-0000-4000-8000-000000000003'::uuid, '9000000103'),
    ('a0000000-0000-4000-8000-000000000004'::uuid, '9000000104'),
    ('b0000000-0000-4000-8000-000000000001'::uuid, '9000000201'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, '9000000202'),
    ('c0000000-0000-4000-8000-000000000001'::uuid, '9000000301')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  '91' || mobile || '@mobile.invalid',
  extensions.crypt('Demo@1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from seed_users;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@mobile.invalid';

insert into public.platform_admins (user_id, name)
values ('10000000-0000-4000-8000-000000000001', 'Demo Super Admin');

insert into public.profiles (id, tenant_id, name, mobile, role, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Owner A', '9000000101', 'ADMIN', 'ACTIVE'),
  ('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Staff A', '9000000102', 'STAFF', 'ACTIVE'),
  ('a0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Former Staff A', '9000000103', 'STAFF', 'INACTIVE'),
  ('a0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Staff A2', '9000000104', 'STAFF', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Demo Owner B', '9000000201', 'ADMIN', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Demo Staff B', '9000000202', 'STAFF', 'ACTIVE'),
  ('c0000000-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Demo Owner C', '9000000301', 'ADMIN', 'ACTIVE');

-- One audit row per tenant so cross-tenant read tests have something to (not) see.
insert into public.audit_logs (tenant_id, user_id, action, target_type, target_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000001', 'seed.created', 'tenant', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b0000000-0000-4000-8000-000000000001', 'seed.created', 'tenant', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Item catalog (dummy). Rates in paise: 1000 = ₹10.
insert into public.rental_items (id, tenant_id, name, category, unit_label, total_quantity_owned, rate_paise, rate_unit, active)
values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Plastic chair', 'Furniture', 'piece', 500, 1000, 'PER_DAY', true),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Round table', 'Furniture', 'piece', 60, 15000, 'PER_DAY', true),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shamiana 20x20 ft', 'Tents & Shamiana', 'piece', 8, 150000, 'PER_EVENT', true),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'LED string lights', 'Lighting', 'set', 40, 25000, 'PER_EVENT', true),
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Generator 15 kVA', 'Generator', 'piece', 2, 200000, 'PER_DAY', true),
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Steel plate', 'Utensils', 'piece', 1000, 300, 'PER_EVENT', true),
  ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sofa set', 'Furniture', 'set', 10, 80000, 'PER_DAY', true),
  ('a1000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Old wooden stage', 'Decoration', 'piece', 1, 100000, 'PER_EVENT', false),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Folding chair', 'Furniture', 'piece', 300, 1200, 'PER_DAY', true),
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Wedding tent 40x60 ft', 'Tents & Shamiana', 'piece', 2, 800000, 'PER_EVENT', true),
  ('b1000000-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'DJ speaker', 'Sound', 'pair', 4, 300000, 'PER_EVENT', true);

-- Customers (dummy names, obviously fake 9111111xxx numbers).
insert into public.rental_customers (id, tenant_id, name, mobile, whatsapp_number, preferred_channel, address)
values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Customer Ravi', '9111111101', '9111111101', 'WHATSAPP', 'Demo Colony, Plot 1'),
  ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Customer Sunita', '9111111102', null, 'SMS', null),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Demo Customer Imran', '9111111201', '9111111201', 'WHATSAPP', null);

-- Bookings (dates relative to today, IST). Line rates are snapshotted from
-- the catalog by trigger; the values below are placeholders.
insert into public.rental_orders (id, tenant_id, customer_id, event_start_date, event_start_time, expected_return_date, notes)
values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date, '09:00', (now() at time zone 'Asia/Kolkata')::date + 2, 'Demo wedding booking'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b2000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date, null, (now() at time zone 'Asia/Kolkata')::date, null);

insert into public.rental_order_items (tenant_id, rental_order_id, rental_item_id, quantity, item_name_snapshot, unit_label_snapshot, rate_paise_snapshot, rate_unit_snapshot)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 100, '', '', 0, 'PER_DAY'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 1, '', '', 0, 'PER_DAY'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 50, '', '', 0, 'PER_DAY');

-- WhatsApp Cloud API (local tests only): Tenant A is connected to the mock
-- Graph API used by the e2e suite. The token is a dummy value.
insert into public.whatsapp_connections (tenant_id, waba_id, phone_number_id, display_phone_number)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '100000000000001', '200000000000001', '+91 90000 00100');
select public.wa_set_credentials('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dummy-local-access-token-not-real-0001');
update public.rental_customers set whatsapp_opt_in = true where id = 'a2000000-0000-4000-8000-000000000001';

-- Tenant A has the WhatsApp automation add-on (used by the e2e suite).
update public.tenants set whatsapp_addon = true where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
