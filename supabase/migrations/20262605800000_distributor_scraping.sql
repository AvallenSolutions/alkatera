-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 2: SCRAPING PIPELINE
-- ============================================================
-- After brand profiles are created (Phase 1), we dispatch background
-- agents to search public sources for sustainability data on each brand.
-- Findings are stored with source attribution + confidence so the UI
-- (Phase 5) can show a defensible "we found X, here's where" trail.
--
-- Architecture: a Netlify scheduled function hits
-- /api/cron/process-scraping-queue every 5 minutes. That route dequeues
-- up to 3 'queued' jobs, marks them 'running', and runs the brand-agent
-- against each. The agent walks the active scraping_sources, fetches
-- pages, extracts fields via claude-haiku-4-5-20251001, and writes rows
-- into scraped_brand_data. Old findings for the same brand+field are
-- soft-superseded via the superseded_by FK so we always know the latest.
-- ============================================================

begin;

-- ============================================================
-- Tables
-- ============================================================

-- Registry of sources the scraping agents know how to talk to.
-- Rows here drive which scrapers run; deactivating a source via
-- active=false stops it without touching code.
create table public.scraping_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  url_template  text,
  source_type   text not null check (source_type in (
                  'certification_db','brand_website','regulatory_body',
                  'company_registry','other'
                )),
  reliability   integer not null default 2 check (reliability between 1 and 3),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- One job per (brand_profile, scraping run). 'queued' is the only state
-- the cron route picks up; everything else is in-flight or terminal.
create table public.scraping_jobs (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  status              text not null default 'queued' check (status in (
                        'queued','running','complete','error','skipped'
                      )),
  triggered_by        text not null default 'auto' check (triggered_by in (
                        'auto','manual','sku_import'
                      )),
  started_at          timestamptz,
  completed_at        timestamptz,
  sources_attempted   integer not null default 0,
  sources_succeeded   integer not null default 0,
  error_message       text,
  created_at          timestamptz not null default now()
);

-- One row per (brand, field, source). Re-running an agent inserts a new
-- row and points superseded_by from the old row to the new one so the
-- UI can either show "current truth" or the audit trail.
create table public.scraped_brand_data (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  scraping_job_id     uuid references public.scraping_jobs(id) on delete set null,
  field_key           text not null,
  field_value         text,
  field_value_numeric numeric,
  source_name         text not null,
  source_url          text,
  confidence          numeric(3,2) not null default 0.5 check (confidence between 0 and 1),
  extraction_method   text not null check (extraction_method in (
                        'dom_parse','llm_extract','pattern_match','api'
                      )),
  scraped_at          timestamptz not null default now(),
  superseded_by       uuid references public.scraped_brand_data(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index scraping_jobs_brand_idx           on public.scraping_jobs (brand_profile_id);
create index scraping_jobs_status_created_idx  on public.scraping_jobs (status, created_at);
create index scraping_jobs_org_idx             on public.scraping_jobs (distributor_org_id);
create index scraped_brand_data_brand_idx      on public.scraped_brand_data (brand_profile_id);
create index scraped_brand_data_field_idx      on public.scraped_brand_data (brand_profile_id, field_key)
  where superseded_by is null;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.scraping_sources    enable row level security;
alter table public.scraping_jobs       enable row level security;
alter table public.scraped_brand_data  enable row level security;

-- scraping_sources is a global catalogue. All authenticated users can
-- read it (it tells the UI what we *might* know); writes are service-
-- role only.
create policy "anyone authenticated can read scraping sources"
  on public.scraping_sources for select
  using (auth.uid() is not null);

create policy "distributor members read scraping jobs"
  on public.scraping_jobs for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers create scraping jobs"
  on public.scraping_jobs for insert
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

create policy "distributor members read scraped data"
  on public.scraped_brand_data for select
  using (
    brand_profile_id in (
      select id from public.brand_profiles where distributor_org_id in (
        select distributor_org_id from public.distributor_members
        where user_id = auth.uid()
      )
    )
  );

-- All scraped_brand_data writes happen via service role (cron route).
-- No user-facing insert/update/delete policies needed.

-- ============================================================
-- Seed sources
-- ============================================================
insert into public.scraping_sources (name, url_template, source_type, reliability) values
  ('Brand Website',                 null,                                                            'brand_website',     2),
  ('Wikipedia',                     'https://en.wikipedia.org/wiki/{brand_slug}',                    'other',             2),
  ('B Corp Directory',              'https://www.bcorporation.net/en-us/find-a-b-corp/',             'certification_db',  1),
  ('Carbon Trust Certification',    'https://www.carbontrust.com/what-we-do/assurance-and-certification/carbon-footprinting', 'certification_db', 1),
  ('Organic Farmers and Growers',   'https://ofgorganic.org',                                        'certification_db',  1),
  ('Fairtrade Foundation',          'https://www.fairtrade.org.uk/buying-fairtrade/product-sourcing/', 'certification_db', 1),
  ('Rainforest Alliance',           'https://www.rainforest-alliance.org/find-certified/',           'certification_db',  1),
  ('CIVB (Bordeaux Wine)',          'https://www.bordeaux.com',                                      'regulatory_body',   1),
  ('Drinks Ireland',                'https://www.drinksireland.ie',                                  'regulatory_body',   2),
  ('Companies House UK',            'https://find-and-update.company-information.service.gov.uk',    'company_registry',  1),
  ('Sedex SMETA',                   'https://www.sedex.com',                                         'certification_db',  2)
on conflict do nothing;

commit;
