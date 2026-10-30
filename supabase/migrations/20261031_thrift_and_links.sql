-- Thrift (voluntary) savings for employees, registration-link switches and
-- chairman-only approval support.
--
-- Idempotent: safe to run more than once.

-- Voluntary savings agreed between the employee and the admin.
alter table public.employees
  add column if not exists thrift_enabled boolean not null default false;
alter table public.employees
  add column if not exists thrift_amount numeric(14, 2) not null default 0;

-- Registration links can be switched off per organization.
alter table public.organization_settings
  add column if not exists employee_registration_enabled boolean not null default true;
alter table public.organization_settings
  add column if not exists member_registration_enabled boolean not null default true;

-- The money-platform tables were created outside these migrations, so drop any
-- restrictive check on the account/transaction types before introducing the new
-- THRIFT account type and THRIFT_* ledger transaction types.
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.financial_accounts'::regclass
      and contype = 'c'
  loop
    if c.def ilike '%account_type%' then
      execute format('alter table public.financial_accounts drop constraint %I', c.conname);
    end if;
  end loop;

  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.ledger_transactions'::regclass
      and contype = 'c'
  loop
    if c.def ilike '%transaction_type%' then
      execute format('alter table public.ledger_transactions drop constraint %I', c.conname);
    end if;
  end loop;
end $$;
