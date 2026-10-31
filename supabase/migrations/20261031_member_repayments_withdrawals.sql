-- Member loan repayments, member withdrawals and member loan interest.
-- Idempotent.

alter table public.withdrawal_requests
  add column if not exists member_id uuid references public.members(id) on delete cascade;
alter table public.bank_accounts
  add column if not exists member_id uuid references public.members(id) on delete cascade;

alter table public.withdrawal_requests alter column employee_id drop not null;
alter table public.bank_accounts alter column employee_id drop not null;

alter table public.organization_settings
  add column if not exists member_loan_interest_rate numeric(6, 2) not null default 1;

-- Per-member interest override (null = use the organization rate).
alter table public.members
  add column if not exists loan_interest_rate numeric(6, 2);

-- Employer-controlled member loan terms.
alter table public.organization_settings
  add column if not exists member_loan_collateral_required boolean not null default false;
alter table public.organization_settings
  add column if not exists member_loan_processing_fee_percentage numeric(6, 2) not null default 0;
alter table public.organization_settings
  add column if not exists member_loan_duration_months integer not null default 6;

-- Collateral submitted with a member loan application.
alter table public.loan_applications
  add column if not exists collateral_description text;
alter table public.loan_applications
  add column if not exists collateral_document_url text;

-- 10 naira on every 1000 = 1% flat interest for member loans.
update public.organization_settings
  set member_loan_interest_rate = 1
  where member_loan_interest_rate is null;
