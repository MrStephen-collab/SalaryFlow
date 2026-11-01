-- Employer announcements shown as a scrolling ticker in the member and
-- employee portal headers. Idempotent.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message text not null,
  audience text not null default 'ALL',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing deployments: add the audience column.
alter table public.announcements
  add column if not exists audience text not null default 'ALL';

alter table public.announcements
  drop constraint if exists announcements_audience_check;
alter table public.announcements
  add constraint announcements_audience_check
  check (audience in ('ALL', 'EMPLOYEE', 'MEMBER'));

create index if not exists announcements_org_idx
  on public.announcements (organization_id, active, created_at desc);

alter table public.announcements enable row level security;

drop policy if exists announcements_staff_read on public.announcements;
create policy announcements_staff_read on public.announcements
  for select to authenticated
  using (
    organization_id in (
      select up.organization_id from public.user_profiles up where up.user_id = auth.uid()
    )
  );

drop policy if exists announcements_self_member on public.announcements;
create policy announcements_self_member on public.announcements
  for select to authenticated
  using (
    organization_id in (
      select m.organization_id from public.members m where m.user_id = auth.uid()
    )
    or organization_id in (
      select e.organization_id from public.employees e where e.user_id = auth.uid()
    )
  );
