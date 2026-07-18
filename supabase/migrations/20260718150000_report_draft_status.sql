-- Phase C: draft-then-edit narratives.
--
-- 'draft' = row created and narratives drafted into data_snapshot, awaiting
-- review in the report builder. Deliberately NOT an in-flight state: the
-- landing page shows a Draft chip, does not poll it, and never times it out.

ALTER TABLE public.generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_status_check;

ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending'::text,
    'aggregating_data'::text,
    'building_content'::text,
    'generating_charts'::text,
    'generating_document'::text,
    'completed'::text,
    'failed'::text
  ]));

COMMENT ON COLUMN public.generated_reports.data_snapshot IS
  'Draft-then-edit narrative store and CSRD data snapshot: { narratives, keyFindings, narrative_meta, inputs }. Narrative blocks carry aiGenerated flags (false once human-edited) as the audit trail.';
