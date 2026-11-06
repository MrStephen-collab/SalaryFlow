-- Rename the main employee-loan pool to Thrift Pool.
-- Safe to run more than once.

begin;

update public.fund_accounts
set name = 'Thrift Pool'
where name ilike '%lending%'
   or name ilike '%salary%pool%';

update public.ledger_accounts
set name = 'Thrift Pool'
where code = '1000';

commit;
