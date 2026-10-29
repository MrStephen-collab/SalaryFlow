-- ============================================================================
-- SalaryFlow money platform
--   1. Gateway funding for organizations (Paystack/Flutterwave collections)
--   2. Automatic salary disbursement on the configured payment day
--   3. External members (non-employees), savings, and savings-backed loans
--
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
-- Run this in Supabase dashboard -> SQL editor for project
-- okvhhesndfwfwlgkqcm, then reload the app.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.sf_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- External members are a first-class role so routing/permissions stay explicit.
insert into public.roles (name, description, is_system)
select 'MEMBER', 'External savings and loan member (not an employee)', true
where not exists (select 1 from public.roles where name = 'MEMBER');

-- ---------------------------------------------------------------------------
-- 1. Gateway payment intents (funding + savings deposits)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purpose text not null check (purpose in ('ORGANIZATION_FUNDING', 'SAVINGS_DEPOSIT')),
  fund_account_id uuid references public.fund_accounts(id) on delete set null,
  member_id uuid,
  payer_user_id uuid,
  payer_email text,
  provider text not null default 'paystack',
  internal_reference text not null unique,
  provider_reference text unique,
  access_code text,
  authorization_url text,
  amount numeric(14, 2) not null check (amount > 0),
  fee numeric(14, 2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED', 'REVERSED')),
  channel text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_org_idx
  on public.payment_transactions (organization_id, created_at desc);
create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status);

drop trigger if exists payment_transactions_touch on public.payment_transactions;
create trigger payment_transactions_touch
  before update on public.payment_transactions
  for each row execute function public.sf_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Automatic salary disbursement
-- ---------------------------------------------------------------------------
create table if not exists public.salary_disbursement_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  salary_period_id uuid not null references public.salary_periods(id) on delete cascade,
  fund_account_id uuid references public.fund_accounts(id) on delete set null,
  scheduled_for date not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  total_amount numeric(14, 2) not null default 0,
  employee_count integer not null default 0,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  trigger_source text not null default 'SCHEDULED'
    check (trigger_source in ('SCHEDULED', 'MANUAL')),
  triggered_by uuid,
  failure_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salary_period_id)
);

create index if not exists salary_disbursement_runs_due_idx
  on public.salary_disbursement_runs (status, scheduled_for);

create table if not exists public.salary_disbursement_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.salary_disbursement_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  salary_record_id uuid references public.salary_records(id) on delete set null,
  amount numeric(14, 2) not null check (amount >= 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CREDITED', 'SKIPPED', 'FAILED')),
  ledger_reference text,
  error text,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id)
);

create index if not exists salary_disbursement_items_run_idx
  on public.salary_disbursement_items (run_id);

-- ---------------------------------------------------------------------------
-- 3. External members
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid unique references public.users(id) on delete set null,
  member_number text not null,
  first_name text not null,
  last_name text not null,
  other_names text,
  email text not null,
  phone text,
  address text,
  date_of_birth date,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  kyc_status text not null default 'PENDING'
    check (kyc_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  joined_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, member_number)
);

create unique index if not exists members_org_email_idx
  on public.members (organization_id, lower(email));

drop trigger if exists members_touch on public.members;
create trigger members_touch
  before update on public.members
  for each row execute function public.sf_touch_updated_at();

-- A member's wallet lives in financial_accounts (account_type SAVINGS), so the
-- immutable double-entry ledger continues to be the single source of truth.
create index if not exists members_user_idx on public.members (user_id);

-- ---------------------------------------------------------------------------
-- 4. Savings movements
-- ---------------------------------------------------------------------------
create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  transaction_type text not null
    check (transaction_type in ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'ADJUSTMENT')),
  amount numeric(14, 2) not null check (amount > 0),
  direction text not null check (direction in ('IN', 'OUT')),
  reference text not null unique,
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists savings_transactions_member_idx
  on public.savings_transactions (member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Extend existing tables so members can hold balances and loans
-- ---------------------------------------------------------------------------
alter table public.financial_accounts
  alter column employee_id drop not null;

alter table public.financial_accounts
  add column if not exists member_id uuid references public.members(id) on delete cascade;

create unique index if not exists financial_accounts_member_type_idx
  on public.financial_accounts (member_id, account_type)
  where member_id is not null;

alter table public.loan_applications
  alter column employee_id drop not null;

alter table public.loan_applications
  add column if not exists member_id uuid references public.members(id) on delete cascade;

create index if not exists loan_applications_member_idx
  on public.loan_applications (member_id, created_at desc);

alter table public.loan_repayments
  add column if not exists member_id uuid references public.members(id) on delete set null;

alter table public.payment_transactions
  add column if not exists member_id uuid references public.members(id) on delete set null;

alter table public.organization_settings
  add column if not exists salary_payment_day smallint
    check (salary_payment_day is null or (salary_payment_day between 1 and 28));
alter table public.organization_settings
  add column if not exists auto_disburse_salaries boolean not null default false;
alter table public.organization_settings
  add column if not exists savings_min_membership_months smallint not null default 6;
alter table public.organization_settings
  add column if not exists member_loan_multiplier numeric(4, 2) not null default 2.00;
alter table public.organization_settings
  add column if not exists member_savings_withdrawals_enabled boolean not null default true;
alter table public.organization_settings
  add column if not exists gateway_fee_bearer text not null default 'ORGANIZATION'
    check (gateway_fee_bearer in ('ORGANIZATION', 'CUSTOMER'));

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;
alter table public.salary_disbursement_runs enable row level security;
alter table public.salary_disbursement_items enable row level security;
alter table public.members enable row level security;
alter table public.savings_transactions enable row level security;

drop policy if exists payment_transactions_staff_read on public.payment_transactions;
create policy payment_transactions_staff_read on public.payment_transactions
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists payment_transactions_staff_insert on public.payment_transactions;
create policy payment_transactions_staff_insert on public.payment_transactions
  for insert to authenticated
  with check (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists salary_disbursement_runs_staff_read on public.salary_disbursement_runs;
create policy salary_disbursement_runs_staff_read on public.salary_disbursement_runs
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists salary_disbursement_items_staff_read on public.salary_disbursement_items;
create policy salary_disbursement_items_staff_read on public.salary_disbursement_items
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists members_staff_read on public.members;
create policy members_staff_read on public.members
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists members_staff_insert on public.members;
create policy members_staff_insert on public.members
  for insert to authenticated
  with check (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists members_staff_update on public.members;
create policy members_staff_update on public.members
  for update to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists members_self_read on public.members;
create policy members_self_read on public.members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists members_self_update on public.members;
create policy members_self_update on public.members
  for update to authenticated
  using (user_id = auth.uid());

drop policy if exists savings_transactions_staff_read on public.savings_transactions;
create policy savings_transactions_staff_read on public.savings_transactions
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists savings_transactions_member_read on public.savings_transactions;
create policy savings_transactions_member_read on public.savings_transactions
  for select to authenticated
  using (
    member_id in (select m.id from public.members m where m.user_id = auth.uid())
  );

drop policy if exists financial_accounts_member_read on public.financial_accounts;
create policy financial_accounts_member_read on public.financial_accounts
  for select to authenticated
  using (
    member_id in (select m.id from public.members m where m.user_id = auth.uid())
  );

commit;
