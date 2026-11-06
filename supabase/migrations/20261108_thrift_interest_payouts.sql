-- Thrift interest: show savings released during the interest month.
--
-- Interest is now calculated on:
--   prior balance + contributions - same-month thrift payouts
-- so money moved out of thrift savings does not earn a full month's interest.

begin;

alter table public.thrift_interest_accruals
  add column if not exists payouts numeric(14, 2) not null default 0;

commit;
