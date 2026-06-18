-- Staleness tracking for the openlca_no_match flag.
--
-- The flag (added in 20262703800000) lets the waterfall resolver skip doomed
-- live OpenLCA calls for processes confirmed absent from both databases. But
-- once set it was never re-verified: when a later ecoinvent/Agribalyse update
-- DOES add the process, the material keeps resolving from its proxy factor
-- forever. This adds a timestamp so the resolver re-tries a live lookup once
-- the verdict is older than 90 days (NO_MATCH_TTL_DAYS in
-- lib/impact-waterfall-resolver.ts).
--
-- Deliberately NO backfill: existing flagged rows keep a NULL timestamp,
-- which the resolver treats as stale, so each gets one fresh live attempt on
-- its next recalculation. Cost is bounded (one extra OpenLCA call per flagged
-- material per recalculation, then quiet for 90 days) and accuracy wins.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS openlca_no_match_at timestamptz;

COMMENT ON COLUMN public.product_materials.openlca_no_match_at IS
  'When the openlca_no_match verdict was last confirmed by a live lookup. NULL or older than 90 days means the resolver will re-try a live OpenLCA calculation on the next recalculation and refresh/clear the flag based on the result.';

-- Extend the reset invariant: a re-match (data_source_id change) clears both
-- the flag and its timestamp so the new process gets a fresh live attempt.
CREATE OR REPLACE FUNCTION public.reset_openlca_no_match_on_rematch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_source_id IS DISTINCT FROM OLD.data_source_id THEN
    NEW.openlca_no_match := false;
    NEW.openlca_no_match_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_openlca_no_match ON public.product_materials;
CREATE TRIGGER trg_reset_openlca_no_match
  BEFORE UPDATE OF data_source_id ON public.product_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_openlca_no_match_on_rematch();
