-- ============================================================================
-- Outbound reply-hook (Spec C): background auto-enrich tracking for brand
-- reports. The generator returns the /r/[token] link INSTANTLY from typed
-- inputs; a background Inngest job (outreach/report.enrich) then runs
-- deepEnrichBrand and upgrades the stored estimate. These columns let the
-- admin UI show where that background pass has got to, and never block the link.
-- ============================================================================

alter table public.brand_reports
  add column if not exists website text,
  add column if not exists enrichment_status text not null default 'idle'
    check (enrichment_status in ('idle', 'pending', 'running', 'done', 'failed')),
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_error text;

comment on column public.brand_reports.enrichment_status is
  'Background auto-enrich state: idle (none requested), pending (queued to Inngest), '
  'running, done (estimate upgraded), failed (see enrichment_error).';
