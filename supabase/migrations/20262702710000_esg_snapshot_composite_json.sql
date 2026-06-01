-- #3a: store the FULL composite object (incl. the *_breakdown explainer objects
-- that /performance and the breakdown modal read) so the instant read path can
-- serve today's snapshot without re-running the 4 pillar builders (~39 queries).
-- The existing `breakdown` column only holds `.sub` sub-scores and is therefore
-- insufficient to reconstruct the explainers. Both columns nullable: a NULL
-- composite_json forces the recompute path until the first write populates it.
ALTER TABLE public.esg_score_snapshots
  ADD COLUMN IF NOT EXISTS composite_json jsonb;

ALTER TABLE public.esg_score_snapshots
  ADD COLUMN IF NOT EXISTS composite_generated_at timestamptz;

COMMENT ON COLUMN public.esg_score_snapshots.composite_json IS
  'Full VitalityComposite object (pillars + sub + *_breakdown explainers + weights). Served verbatim on the instant read path; rebuilt on ?fresh=1.';
COMMENT ON COLUMN public.esg_score_snapshots.composite_generated_at IS
  'When composite_json was last computed. Lets the client decide staleness without recomputing.';

-- PostgREST caches the schema; without this the new columns are invisible to
-- the API layer and writes to them are silently dropped (see tasks/lessons.md).
NOTIFY pgrst, 'reload schema';
