-- ============================================================================
-- SalaryFlow: replace payroll with employer-funded thrift savings
--
--   1. New `thrift_fundings` table (monthly employer contributions)
--   2. Loan repayments can be settled from thrift funding
--   3. Remove the salary / payroll structure
--
-- WARNING: this migration is destructive. It drops salary periods, salary
-- records, salary imports and payroll deduction tables, and removes the
-- salary columns from employees, loan products and organization settings.
-- Take a backup before running it against a live project.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Monthly thrift funding
--
-- The employer withholds the employee's agreed thrift amount from their
-- externally paid salary and records it here. A funding is split between the
-- employee's active loan repayment and their thrift savings balance.
-- ---------------------------------------------------------------------------
create table if not exists public.thrift_fundings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_month date not null,
  amount numeric(14, 2) not null check (amount > 0),
  loan_repayment_applied numeric(14, 2) not null default 0,
  thrift_credit numeric(14, 2) not null default 0,
  reference text not null unique,
  status text not null default 'POSTED'
    check (status in ('POSTED', 'REVERSED')),
  notes text,
  funded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_month)
);

create index if not exists thrift_fundings_org_idx
  on public.thrift_fundings (organization_id, period_month desc, created_at desc);
create index if not exists thrift_fundings_employee_idx
  on public.thrift_fundings (employee_id, period_month desc);

drop trigger if exists thrift_fundings_touch on public.thrift_fundings;
create trigger thrift_fundings_touch
  before update on public.thrift_fundings
  for each row execute function public.sf_touch_updated_at();

alter table public.thrift_fundings enable row level security;

drop policy if exists thrift_fundings_staff on public.thrift_fundings;
create policy thrift_fundings_staff on public.thrift_fundings
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists thrift_fundings_self on public.thrift_fundings;
create policy thrift_fundings_self on public.thrift_fundings
  for select to authenticated
  using (
    employee_id in (
      select e.id from public.employees e where e.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Loan repayments can come from thrift funding
-- ---------------------------------------------------------------------------
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.loan_repayments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_method%'
  loop
    execute format(
      'alter table public.loan_repayments drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.loan_repayments
  drop constraint if exists loan_repayments_payment_method_check;

alter table public.loan_repayments
  add constraint loan_repayments_payment_method_check
  check (
    payment_method in (
      'SALARY_DEDUCTION',
      'BANK_TRANSFER',
      'CASH',
      'CARD',
      'THRIFT_FUNDING'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. The salary pool is now a general lending pool
-- ---------------------------------------------------------------------------
update public.fund_accounts
set name = 'Lending Fund'
where name ilike '%salary%pool%';

-- ---------------------------------------------------------------------------
-- 4. Drop the salary / payroll tables
-- ---------------------------------------------------------------------------
drop table if exists public.deduction_records cascade;
drop table if exists public.salary_import_rows cascade;
drop table if exists public.salary_imports cascade;
drop table if exists public.salary_disbursement_items cascade;
drop table if exists public.salary_disbursement_runs cascade;
drop table if exists public.salary_records cascade;
drop table if exists public.salary_periods cascade;

-- ---------------------------------------------------------------------------
-- 5. Drop salary columns
-- ---------------------------------------------------------------------------
alter table public.employees
  drop column if exists salary;

alter table public.loan_products
  drop column if exists maximum_salary_deduction_percentage,
  drop column if exists minimum_salary;

alter table public.organization_settings
  drop column if exists salary_cycle,
  drop column if exists max_salary_deduction_percentage,
  drop column if exists min_salary,
  drop column if exists salary_payment_day,
  drop column if exists auto_disburse_salaries;

commit;
