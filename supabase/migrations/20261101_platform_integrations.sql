-- Platform integrations managed by the super admin (payment, email, SMS).
-- Values are read with the service role; no RLS policies are granted.

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
  ('payment_provider', 'payment', 'Payment provider (paystack / flutterwave)', false),
  ('paystack_public_key', 'payment', 'Paystack public key', false),
  ('paystack_secret_key', 'payment', 'Paystack secret key', true),
  ('flutterwave_secret_key', 'payment', 'Flutterwave secret key', true),
  ('email_provider', 'email', 'Email provider (resend / smtp)', false),
  ('email_api_key', 'email', 'Email API key', true),
  ('email_from', 'email', 'From address', false),
  ('sms_provider', 'sms', 'SMS provider (termii / twilio)', false),
  ('sms_api_key', 'sms', 'SMS API key', true),
  ('sms_sender', 'sms', 'SMS sender ID', false)
on conflict (key) do nothing;
