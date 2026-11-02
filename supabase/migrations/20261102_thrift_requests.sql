-- Employees request release of their thrift savings; the employer releases each
-- request individually. Idempotent.

create table if not exists public.thrift_release_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'REJECTED')),
  notes text,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thrift_requests_org_idx
  on public.thrift_release_requests (organization_id, status, created_at desc);

alter table public.thrift_release_requests enable row level security;

drop policy if exists thrift_requests_staff on public.thrift_release_requests;
create policy thrift_requests_staff on public.thrift_release_requests
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists thrift_requests_self on public.thrift_release_requests;
create policy thrift_requests_self on public.thrift_release_requests
  for select to authenticated
  using (
    employee_id in (
      select e.id from public.employees e where e.user_id = auth.uid()
    )
  );
