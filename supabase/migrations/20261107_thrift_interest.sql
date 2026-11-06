-- ============================================================================
-- SalaryFlow: monthly interest on employee thrift savings
--
--   * Organization-level annual interest rate (defaults to 5%)
--   * One accrual row per employee per month, posted into the thrift savings
--     account through the ledger. The unique constraint makes posting
--     idempotent.
-- ============================================================================

begin;

alter table public.organization_settings
  add column if not exists thrift_interest_rate numeric(5, 2) not null default 5;

alter table public.organization_settings
  drop constraint if exists organization_settings_thrift_interest_rate_check;

alter table public.organization_settings
  add constraint organization_settings_thrift_interest_rate_check
  check (thrift_interest_rate >= 0 and thrift_interest_rate <= 100);

create table if not exists public.thrift_interest_accruals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_month date not null,
  opening_balance numeric(14, 2) not null default 0,
  contributions numeric(14, 2) not null default 0,
  annual_rate numeric(5, 2) not null,
  eligible_days integer not null check (eligible_days > 0),
  interest_amount numeric(14, 2) not null check (interest_amount >= 0),
  closing_balance numeric(14, 2) not null,
  reference text not null unique,
  status text not null default 'POSTED'
    check (status in ('POSTED', 'REVERSED')),
  notes text,
  posted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_month)
);

create index if not exists thrift_interest_org_idx
  on public.thrift_interest_accruals (organization_id, period_month desc, created_at desc);
create index if not exists thrift_interest_employee_idx
  on public.thrift_interest_accruals (employee_id, period_month desc);

drop trigger if exists thrift_interest_accruals_touch on public.thrift_interest_accruals;
create trigger thrift_interest_accruals_touch
  before update on public.thrift_interest_accruals
  for each row execute function public.sf_touch_updated_at();

alter table public.thrift_interest_accruals enable row level security;

drop policy if exists thrift_interest_staff on public.thrift_interest_accruals;
create policy thrift_interest_staff on public.thrift_interest_accruals
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists thrift_interest_self on public.thrift_interest_accruals;
create policy thrift_interest_self on public.thrift_interest_accruals
  for select to authenticated
  using (
    employee_id in (
      select e.id from public.employees e where e.user_id = auth.uid()
    )
  );

commit;
