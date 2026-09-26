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
