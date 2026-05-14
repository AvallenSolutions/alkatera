-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 3: BRAND OUTREACH + UPLOAD PORTAL
-- ============================================================
-- This phase wires the distributor → brand → distributor loop:
--   1. Distributor presses "send outreach". Each targeted brand gets an
--      email via Resend with a tokenised link to /brand-upload/[token].
--   2. Brand staff land on a public page, drop their files, hit submit.
--      The submit route writes via service role (no Supabase account
--      needed for the brand uploader).
--   3. Distributor sees submissions in their outreach dashboard.
--
-- Phase 1 already provisioned brand_profiles.upload_token,
-- outreach_email, first/last_submission_at and the brand-documents
-- storage bucket. This migration adds the two tracking tables:
--   - brand_document_submissions: one row per uploaded file
--   - outreach_emails: one row per email sent (audit + status)
-- ============================================================

begin;

-- ============================================================
-- Tables
-- ============================================================

-- One row per file a brand uploads via the public token portal. Each
-- physical file in Storage maps to one row here; metadata such as the
-- self-declared document type and the submitter's contact details live
-- on the row so the distributor can see who sent what.
create table public.brand_document_submissions (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  file_name           text not null,
  file_path           text not null,
  file_type           text not null,
  file_size_bytes     integer,
  document_type       text not null check (document_type in (
                        'lca_report','carbon_report','water_usage','sustainability_report',
                        'packaging_data','certification','esg_report','other'
                      )),
  -- Vintage / batch tagging — schema only in Phase 3; the UI for it
  -- lands in Phase 16 alongside the brand-side vintage dashboard.
  vintage_year        integer,
  batch_reference     text,
  submitter_name      text,
  submitter_email     text,
  submitter_job_title text,
  notes               text,
  processing_status   text not null default 'pending' check (processing_status in (
                        'pending','processing','complete','error'
                      )),
  -- Filled by the Phase 4 document processor.
  extracted_data      jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One row per outbound email. We log every send so the dashboard can
-- show "last contacted X days ago" and so we can enforce a minimum
-- interval between reminders.
create table public.outreach_emails (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  sent_by             uuid references auth.users(id),
  email_type          text not null check (email_type in ('initial','reminder')),
  recipient_email     text not null,
  resend_message_id   text,
  status              text not null default 'sent' check (status in (
                        'sent','delivered','opened','bounced','failed'
                      )),
  error_message       text,
  sent_at             timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index brand_document_submissions_brand_idx       on public.brand_document_submissions (brand_profile_id, created_at desc);
create index brand_document_submissions_distributor_idx on public.brand_document_submissions (distributor_org_id, created_at desc);
create index outreach_emails_brand_idx                  on public.outreach_emails (brand_profile_id, sent_at desc);
create index outreach_emails_distributor_idx            on public.outreach_emails (distributor_org_id, sent_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.brand_document_submissions enable row level security;
alter table public.outreach_emails           enable row level security;

create policy "distributor members read brand documents"
  on public.brand_document_submissions for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "distributor members read outreach emails"
  on public.outreach_emails for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

-- All writes happen via the service-role key from the public brand-upload
-- API route (brand uploaders have no Supabase account) and from the
-- authenticated distributor outreach routes. No user-role insert / update
-- policies are needed.

commit;
