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

-- 10 naira on every 1000 = 1% flat interest for member loans.
update public.organization_settings
  set member_loan_interest_rate = 1
  where member_loan_interest_rate is null;
