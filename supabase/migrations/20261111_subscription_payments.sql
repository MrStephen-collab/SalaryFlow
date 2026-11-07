-- ============================================================================
-- Subscription payments from organizations to the platform owner.
--
-- Payment intents reuse payment_transactions with the SUBSCRIPTION purpose.
-- The plan and billing cycle are stored in metadata and applied when the
-- gateway confirms payment.
-- ============================================================================

begin;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%purpose%'
  loop
    execute format(
      'alter table public.payment_transactions drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.payment_transactions
  add constraint payment_transactions_purpose_check
  check (
    purpose in (
      'ORGANIZATION_FUNDING',
      'SAVINGS_DEPOSIT',
      'SUBSCRIPTION'
    )
  );

commit;
