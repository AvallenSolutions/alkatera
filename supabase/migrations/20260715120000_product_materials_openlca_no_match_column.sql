-- Reconcile production drift: the openlca_no_match COLUMN never landed on
-- product_materials in prod, even though the follow-up migration that adds
-- openlca_no_match_at AND rewrites reset_openlca_no_match_on_rematch() to
-- reference NEW.openlca_no_match did apply. Result: every UPDATE OF
-- data_source_id (e.g. saving packaging) fires trg_reset_openlca_no_match,
-- which touches NEW.openlca_no_match on a table that lacks it, and Postgres
-- raises: record "new" has no field "openlca_no_match".
--
-- This re-adds the base flag column (idempotent; the squashed baseline already
-- defines it, so local/reset environments are unaffected). See the archived
-- origin migration 20262703800000_product_materials_openlca_no_match.sql.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS openlca_no_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_materials.openlca_no_match IS
  'True once a live OpenLCA calculation confirmed this process UUID exists on neither ecoinvent nor Agribalyse. When true the resolver skips the live attempt and resolves from local proxy/staging factors. Reset automatically when data_source_id changes (re-match).';
