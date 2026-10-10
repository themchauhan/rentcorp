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
-- | 9000000401 | Admin (owner)                     | Demo PG House (hostel/PG) |
-- | 9000000402 | Staff                             | Demo PG House (hostel/PG) |
-- | 9000000501 | Admin (owner)                     | Demo PG E (hostel/PG)     |

insert into public.tenants (id, name, phone, email, status, plan, trial_ends_at, subscription_ends_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Tent House A', '9000000100', 'a@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Demo Tent House B', '9000000200', 'b@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Demo Tent House C', '9000000300', 'c@example.test', 'SUSPENDED', 'STANDARD', null, now() - interval '10 days');

-- Hostel / PG businesses (phase 13).
insert into public.tenants (id, name, phone, email, status, plan, trial_ends_at, subscription_ends_at, business_type)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo PG House', '9000000400', 'd@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year', 'HOSTEL_PG'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Demo PG E', '9000000500', 'e@example.test', 'ACTIVE', 'STANDARD', null, now() + interval '1 year', 'HOSTEL_PG');

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
    ('c0000000-0000-4000-8000-000000000001'::uuid, '9000000301'),
    ('d0000000-0000-4000-8000-000000000001'::uuid, '9000000401'),
    ('d0000000-0000-4000-8000-000000000002'::uuid, '9000000402'),
    ('e0000000-0000-4000-8000-000000000001'::uuid, '9000000501')
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
  ('c0000000-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Demo Owner C', '9000000301', 'ADMIN', 'ACTIVE'),
  ('d0000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo PG Owner D', '9000000401', 'ADMIN', 'ACTIVE'),
  ('d0000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo PG Staff D', '9000000402', 'STAFF', 'ACTIVE'),
  ('e0000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Demo PG Owner E', '9000000501', 'ADMIN', 'ACTIVE');

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

-- ---------------------------------------------------------------------------
-- Hostel / PG (phase 13). Dummy data only.
-- ---------------------------------------------------------------------------
insert into public.pg_settings (tenant_id, electricity_paise, deposit_paise, notice_days)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 50000, 1000000, 30),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 0, 500000, 15);

-- Rent in paise: 600000 = ₹6,000 a month.
insert into public.pg_rooms (id, tenant_id, name, floor, rent_mode, rent_paise, under_maintenance, notes)
values
  ('d1000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '101', 'Ground', 'PER_BED', 600000, false, null),
  ('d1000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '102', 'Ground', 'PER_BED', 750000, false, 'Attached bathroom'),
  ('d1000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '201', 'First', 'PER_ROOM', 1400000, false, 'Whole room, AC'),
  ('d1000000-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '202', 'First', 'PER_BED', 600000, true, 'Repainting'),
  ('e1000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'E1', null, 'PER_BED', 500000, false, null);

insert into public.pg_beds (id, tenant_id, room_id, label)
values
  ('d2000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000001', 'A'),
  ('d2000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000001', 'B'),
  ('d2000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000001', 'C'),
  ('d2000000-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000002', 'A'),
  ('d2000000-0000-4000-8000-000000000005', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000002', 'B'),
  ('d2000000-0000-4000-8000-000000000006', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000003', 'A'),
  ('d2000000-0000-4000-8000-000000000007', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000003', 'B'),
  ('d2000000-0000-4000-8000-000000000008', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000004', 'A'),
  ('d2000000-0000-4000-8000-000000000009', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000004', 'B'),
  ('e2000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e1000000-0000-4000-8000-000000000001', 'A'),
  ('e2000000-0000-4000-8000-000000000002', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e1000000-0000-4000-8000-000000000001', 'B');

insert into public.pg_meal_plans (id, tenant_id, name, monthly_paise)
values
  ('d3000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Breakfast + Dinner', 250000),
  ('d3000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'All meals', 350000),
  ('e3000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'All meals', 300000);

-- Residents (dummy names, obviously fake 91111114xx / 91111115xx numbers).
insert into public.rental_customers (id, tenant_id, name, mobile, whatsapp_number, preferred_channel, address)
values
  ('d4000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo Resident Aarav', '9111111401', '9111111401', 'WHATSAPP', null),
  ('d4000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo Resident Kabir', '9111111402', '9111111402', 'WHATSAPP', null),
  ('d4000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo Resident Meera', '9111111403', null, 'SMS', null),
  ('d4000000-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Demo Resident Rohan', '9111111404', '9111111404', 'WHATSAPP', null),
  ('e4000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Demo Resident Esha', '9111111501', '9111111501', 'WHATSAPP', null);

insert into public.pg_resident_details (tenant_id, customer_id, emergency_name, emergency_mobile, occupation, id_type)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000001', 'Demo Parent Aarav', '9111111491', 'Student, Demo College', 'COLLEGE_ID'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000002', null, null, 'Software engineer', 'AADHAAR');

-- Stays (dates relative to today, IST):
--  Aarav: 101-A, joined 40 days ago, fully paid.
--  Kabir: 101-B, joined 75 days ago, paid the first month only (overdue).
--  Meera: whole room 201, joined exactly 1 month ago: rent due today.
--  Rohan: 102-A, joined 100 days ago, on notice, paid up.
--  Esha (PG E): E1-A, joined 20 days ago, nothing paid.
insert into public.pg_stays (id, tenant_id, customer_id, room_id, bed_id, start_date, status, deposit_paise, notice_given_on, planned_move_out, created_by)
values
  ('d5000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000001',
   'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date - 40, 'ACTIVE', 1000000, null, null, 'd0000000-0000-4000-8000-000000000001'),
  ('d5000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000002',
   'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002',
   (now() at time zone 'Asia/Kolkata')::date - 75, 'ACTIVE', 1000000, null, null, 'd0000000-0000-4000-8000-000000000001'),
  ('d5000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000003',
   'd1000000-0000-4000-8000-000000000003', null,
   ((now() at time zone 'Asia/Kolkata')::date - interval '1 month')::date, 'ACTIVE', 2000000, null, null, 'd0000000-0000-4000-8000-000000000001'),
  ('d5000000-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd4000000-0000-4000-8000-000000000004',
   'd1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000004',
   (now() at time zone 'Asia/Kolkata')::date - 100, 'NOTICE', 1000000,
   (now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date + 5, 'd0000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e4000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date - 20, 'ACTIVE', 500000, null, null, 'e0000000-0000-4000-8000-000000000001');

-- Rates copied at move-in: rent + meal plan + electricity (₹500).
insert into public.pg_stay_rates (tenant_id, stay_id, effective_from, rent_paise, meal_plan_id, meal_plan_name, meal_paise, electricity_paise)
select s.tenant_id, s.id, s.start_date, v.rent, v.plan, p.name, coalesce(p.monthly_paise, 0), v.elec
from (values
  ('d5000000-0000-4000-8000-000000000001'::uuid, 600000, 'd3000000-0000-4000-8000-000000000001'::uuid, 50000),
  ('d5000000-0000-4000-8000-000000000002'::uuid, 600000, null::uuid, 50000),
  ('d5000000-0000-4000-8000-000000000003'::uuid, 1400000, 'd3000000-0000-4000-8000-000000000002'::uuid, 50000),
  ('d5000000-0000-4000-8000-000000000004'::uuid, 750000, null::uuid, 50000),
  ('e5000000-0000-4000-8000-000000000001'::uuid, 500000, 'e3000000-0000-4000-8000-000000000001'::uuid, 0)
) as v (stay, rent, plan, elec)
join public.pg_stays s on s.id = v.stay
left join public.pg_meal_plans p on p.id = v.plan;

-- Deposits taken, and rent paid (amounts computed from the rates above).
insert into public.pg_payments (id, tenant_id, stay_id, purpose, amount_paise, mode, received_by, received_at)
values
  ('d6000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000001', 'DEPOSIT', 1000000, 'UPI', 'd0000000-0000-4000-8000-000000000001', now() - interval '40 days'),
  ('d6000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000002', 'DEPOSIT', 1000000, 'CASH', 'd0000000-0000-4000-8000-000000000001', now() - interval '75 days'),
  ('d6000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000004', 'DEPOSIT', 1000000, 'UPI', 'd0000000-0000-4000-8000-000000000001', now() - interval '100 days'),
  ('d6000000-0000-4000-8000-000000000004', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000001', 'RENT',
   private.pg_stay_balance_paise('d5000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Kolkata')::date), 'UPI', 'd0000000-0000-4000-8000-000000000002', now() - interval '9 days'),
  ('d6000000-0000-4000-8000-000000000005', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000002', 'RENT', 650000, 'CASH', 'd0000000-0000-4000-8000-000000000002', now() - interval '74 days'),
  ('d6000000-0000-4000-8000-000000000006', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000003', 'RENT', 1800000, 'UPI', 'd0000000-0000-4000-8000-000000000001', now() - interval '30 days'),
  ('d6000000-0000-4000-8000-000000000007', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000004', 'RENT',
   private.pg_stay_balance_paise('d5000000-0000-4000-8000-000000000004', (now() at time zone 'Asia/Kolkata')::date), 'CARD', 'd0000000-0000-4000-8000-000000000001', now() - interval '8 days');

insert into public.pg_complaints (id, tenant_id, room_id, stay_id, category, priority, description, status, resolution_note)
values
  ('d7000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, 'd5000000-0000-4000-8000-000000000002', 'WIFI', 'URGENT', 'Wi-Fi not working in room 101', 'OPEN', null),
  ('d7000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000002', null, 'PLUMBING', 'NORMAL', 'Bathroom tap leaking', 'IN_PROGRESS', null),
  ('d7000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd1000000-0000-4000-8000-000000000003', null, 'ELECTRICAL', 'NORMAL', 'Tube light not working', 'RESOLVED', 'Replaced the tube light'),
  ('e7000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e1000000-0000-4000-8000-000000000001', null, 'CLEANING', 'NORMAL', 'Room not cleaned', 'OPEN', null);

insert into public.audit_logs (tenant_id, user_id, action, target_type, target_id)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd0000000-0000-4000-8000-000000000001', 'seed.created', 'tenant', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e0000000-0000-4000-8000-000000000001', 'seed.created', 'tenant', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

-- Agreements (phase 14), dates relative to today (IST):
--  Aarav: 11 months from joining, 6-month lock-in (still in lock-in).
--  Kabir: ends in 20 days (shows as "ending soon").
--  Meera: ended 5 days ago, not renewed (shows as "expired").
--  Rohan: none (on notice).  Esha (PG E): 11 months.
insert into public.pg_agreements (id, tenant_id, stay_id, start_date, end_date, lock_in_until, rent_increase_pct, created_by)
values
  ('d8000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date - 40,
   (((now() at time zone 'Asia/Kolkata')::date - 40) + interval '11 months')::date - 1,
   (((now() at time zone 'Asia/Kolkata')::date - 40) + interval '6 months')::date - 1,
   5, 'd0000000-0000-4000-8000-000000000001'),
  ('d8000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000002',
   (now() at time zone 'Asia/Kolkata')::date - 75,
   (now() at time zone 'Asia/Kolkata')::date + 20,
   null, 5, 'd0000000-0000-4000-8000-000000000001'),
  ('d8000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd5000000-0000-4000-8000-000000000003',
   ((now() at time zone 'Asia/Kolkata')::date - interval '1 month')::date,
   (now() at time zone 'Asia/Kolkata')::date - 5,
   null, 10, 'd0000000-0000-4000-8000-000000000001'),
  ('e8000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'e5000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Kolkata')::date - 20,
   (((now() at time zone 'Asia/Kolkata')::date - 20) + interval '11 months')::date - 1,
   null, 5, 'e0000000-0000-4000-8000-000000000001');
