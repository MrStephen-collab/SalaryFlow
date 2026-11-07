-- ============================================================================
-- Per-organization API integrations managed by the platform owner.
--
-- Organization values override platform defaults for payment, email and SMS.
-- Empty values fall back to platform_integrations / environment variables.
-- ============================================================================

begin;

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  category text not null,
  label text not null,
  value text,
  is_secret boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists organization_integrations_org_idx
  on public.organization_integrations (organization_id, category, key);

drop trigger if exists organization_integrations_touch on public.organization_integrations;
create trigger organization_integrations_touch
  before update on public.organization_integrations
  for each row execute function public.sf_touch_updated_at();

alter table public.organization_integrations enable row level security;

commit;
