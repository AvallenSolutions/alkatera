-- Layer 3 hygiene for OpenLCA resolution.
--
-- Some ingredients (typically exotic botanical extracts / NFC juices that have
-- no LCI process in ecoinvent or Agribalyse) are tagged data_source='openlca'
-- with a data_source_id that exists on NEITHER live database. Every
-- recalculation then makes two doomed live calls (primary + alternate server),
-- both 404, before falling back to a documented proxy factor, and surfaces a
-- misleading "calculation failed" warning to the user even though the proxy
-- result is correct.
--
-- This flag lets the waterfall resolver remember a confirmed no-match and skip
-- the live attempt entirely on subsequent runs. It is set automatically the
-- first time a process is found on neither database, and is cleared whenever
-- the ingredient is re-matched (the matching flow overwrites data_source_id /
-- openlca_database and should reset this).

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS openlca_no_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_materials.openlca_no_match IS
  'True once a live OpenLCA calculation confirmed this process UUID exists on neither ecoinvent nor Agribalyse. When true the resolver skips the live attempt and resolves from local proxy/staging factors. Reset automatically when data_source_id changes (re-match).';

-- Centralise the reset invariant: any path that re-points an ingredient at a
-- different process (interactive re-match, bulk auto-match, AI matching, import)
-- changes data_source_id, which must clear a stale no-match verdict so the new
-- process gets a fresh live attempt. The resolver only ever flips the flag to
-- true while leaving data_source_id unchanged, so this never fights it.
CREATE OR REPLACE FUNCTION public.reset_openlca_no_match_on_rematch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_source_id IS DISTINCT FROM OLD.data_source_id THEN
    NEW.openlca_no_match := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_openlca_no_match ON public.product_materials;
CREATE TRIGGER trg_reset_openlca_no_match
  BEFORE UPDATE OF data_source_id ON public.product_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_openlca_no_match_on_rematch();
