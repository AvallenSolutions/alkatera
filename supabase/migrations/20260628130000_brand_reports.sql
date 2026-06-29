-- ============================================================================
-- Outbound reply-hook (Spec B): stored, token-addressable brand footprint
-- reports. Each row is one personalised report we attach to a cold outbound
-- email. The private `token` is the only capability that opens the page at
-- /r/[token]; the row is read server-side via the service-role client, never
-- by an anon API caller — so RLS denies everyone and there is no surface to
-- enumerate prospect data.
--
-- The `estimate` jsonb is a SNAPSHOT of the BrandFootprintEstimate computed by
-- lib/outreach/brand-footprint-estimate.ts at generation time, so the page is
-- stable even if the underlying benchmarks later change.
-- ============================================================================

create table if not exists public.brand_reports (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique,
  brand_name        text not null,
  country_of_origin text,
  category          text,
  inputs            jsonb not null default '{}'::jsonb,
  estimate          jsonb not null,
  status            text not null default 'draft'
                      check (status in ('draft', 'sent', 'viewed', 'claimed')),
  claimed_org_id    uuid references public.organizations(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  first_viewed_at   timestamptz,
  claimed_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.brand_reports is
  'Token-addressable personalised brand footprint reports for cold outbound. '
  'Read server-side by exact token via the service-role client; no anon access.';
comment on column public.brand_reports.token is
  'Unguessable capability token used in the public /r/[token] URL.';
comment on column public.brand_reports.estimate is
  'Snapshot of the BrandFootprintEstimate (lib/outreach/brand-footprint-estimate.ts).';

create index if not exists brand_reports_status_idx on public.brand_reports (status);
create index if not exists brand_reports_created_by_idx on public.brand_reports (created_by);

-- RLS on, with NO public policies: only the service-role client (which bypasses
-- RLS) may read or write. The token lookup happens in trusted server code.
alter table public.brand_reports enable row level security;

-- Keep updated_at fresh on every write.
create or replace function public.set_brand_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brand_reports_set_updated_at on public.brand_reports;
create trigger brand_reports_set_updated_at
  before update on public.brand_reports
  for each row execute function public.set_brand_reports_updated_at();
