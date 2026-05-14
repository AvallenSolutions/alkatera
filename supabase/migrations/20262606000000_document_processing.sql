-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 4: DOCUMENT PROCESSING
-- ============================================================
-- Picks up files written by Phase 3's /brand-upload/[token]/submit
-- route. A Netlify scheduled function hits /api/cron/process-document-queue
-- every 2 minutes; that route dequeues up to 3 document_processing_jobs
-- and runs the processor against each.
--
-- The processor reads the file from the brand-documents bucket,
-- extracts text via the right adapter (pdf-parse / xlsx / image →
-- Claude vision), runs a Claude Sonnet structured-field extraction,
-- and writes findings back into scraped_brand_data (the Phase 2 table)
-- tagged source_name='brand_upload'.
--
-- When a brand-uploaded value disagrees with what we already scraped,
-- we record a brand_data_conflicts row. Some conflicts auto-resolve
-- (high-confidence brand-reported wins); the rest are flagged for the
-- distributor to decide.
-- ============================================================

begin;

-- ============================================================
-- Tables
-- ============================================================

-- One row per document. Mirrors scraping_jobs in shape — same status
-- machine, same audit columns, paired to a brand_document_submissions
-- row so we can find the originating file from any job state.
create table public.document_processing_jobs (
  id                    uuid primary key default gen_random_uuid(),
  submission_id         uuid not null references public.brand_document_submissions(id) on delete cascade,
  brand_profile_id      uuid not null references public.brand_profiles(id) on delete cascade,
  status                text not null default 'queued' check (status in (
                          'queued','processing','complete','error'
                        )),
  fields_extracted      integer not null default 0,
  fields_conflicted     integer not null default 0,
  error_message         text,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

-- One row per disagreement between a new brand-upload finding and an
-- existing scraped finding for the same (brand, field). The conflict
-- row is always created — auto-resolved conflicts get `resolution` set
-- at write time; the UI shows the subset where resolution is null.
create table public.brand_data_conflicts (
  id                    uuid primary key default gen_random_uuid(),
  brand_profile_id      uuid not null references public.brand_profiles(id) on delete cascade,
  field_key             text not null,
  existing_value        text,
  existing_source       text,
  existing_confidence   numeric(3,2),
  new_value             text,
  new_source            text not null default 'brand_upload',
  new_confidence        numeric(3,2),
  resolution            text check (resolution in ('keep_existing','use_new','flagged_for_review')),
  resolved_by           uuid references auth.users(id),
  resolved_at           timestamptz,
  -- Link back to the submission so the resolver UI can show context.
  submission_id         uuid references public.brand_document_submissions(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index document_processing_jobs_submission_idx on public.document_processing_jobs (submission_id);
create index document_processing_jobs_status_idx     on public.document_processing_jobs (status, created_at);
create index document_processing_jobs_brand_idx      on public.document_processing_jobs (brand_profile_id, created_at desc);
create index brand_data_conflicts_brand_idx          on public.brand_data_conflicts (brand_profile_id);
create index brand_data_conflicts_unresolved_idx     on public.brand_data_conflicts (brand_profile_id, created_at)
  where resolution is null;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.document_processing_jobs enable row level security;
alter table public.brand_data_conflicts     enable row level security;

create policy "distributor members read processing jobs"
  on public.document_processing_jobs for select
  using (
    brand_profile_id in (
      select id from public.brand_profiles where distributor_org_id in (
        select distributor_org_id from public.distributor_members where user_id = auth.uid()
      )
    )
  );

create policy "distributor members read conflicts"
  on public.brand_data_conflicts for select
  using (
    brand_profile_id in (
      select id from public.brand_profiles where distributor_org_id in (
        select distributor_org_id from public.distributor_members where user_id = auth.uid()
      )
    )
  );

create policy "owners and data_managers resolve conflicts"
  on public.brand_data_conflicts for update
  using (
    brand_profile_id in (
      select id from public.brand_profiles where distributor_org_id in (
        select distributor_org_id from public.distributor_members
        where user_id = auth.uid() and role in ('owner','data_manager')
      )
    )
  );

-- All inserts happen via service role from the cron route. No
-- user-facing insert policies.

commit;
