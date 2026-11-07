-- ============================================================================
-- Platform integration defaults with separate test and live credentials.
--
-- This is idempotent and also recreates platform_integrations on projects where
-- the original 20261101 migration was never applied.
-- ============================================================================

begin;

create table if not exists public.platform_integrations (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  category text not null,
  label text not null,
  value text,
  is_secret boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.platform_integrations enable row level security;

insert into public.platform_integrations (key, category, label, is_secret)
values
  ('payment_mode', 'payment', 'Payment mode (test / live)', false),
  ('payment_provider', 'payment', 'Payment provider (paystack / flutterwave / manual)', false),
  ('paystack_public_key_test', 'payment', 'Paystack public key', false),
  ('paystack_public_key_live', 'payment', 'Paystack public key', false),
  ('paystack_secret_key_test', 'payment', 'Paystack secret key', true),
  ('paystack_secret_key_live', 'payment', 'Paystack secret key', true),
  ('flutterwave_secret_key_test', 'payment', 'Flutterwave secret key', true),
  ('flutterwave_secret_key_live', 'payment', 'Flutterwave secret key', true),
  ('email_mode', 'email', 'Email mode (test / live)', false),
  ('email_provider', 'email', 'Email provider (resend / smtp)', false),
  ('email_from', 'email', 'From address', false),
  ('email_api_key_test', 'email', 'Email API key', true),
  ('email_api_key_live', 'email', 'Email API key', true),
  ('sms_mode', 'sms', 'SMS mode (test / live)', false),
  ('sms_provider', 'sms', 'SMS provider (termii / twilio)', false),
  ('sms_sender', 'sms', 'SMS sender ID', false),
  ('sms_api_key_test', 'sms', 'SMS API key', true),
  ('sms_api_key_live', 'sms', 'SMS API key', true)
on conflict (key) do nothing;

commit;
