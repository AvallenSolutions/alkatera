-- Emission factor match status on product materials ("apply + flag" model).
--
-- Automatically matched factors (AI proxy suggestions, BOM/Breww imports,
-- guided-wizard auto-matching) are used in calculations straight away but
-- flagged "Matched, please check" until the user confirms them. Explicit
-- user selections are 'verified' immediately.
--
--   verified     - the user picked or confirmed this factor themselves,
--                  or it came from the curated packaging catalogue
--   auto_matched - matched by software; used in calculations, awaiting a
--                  one-click confirmation
--   needs_review - no usable match yet
--   NULL         - unknown provenance (legacy rows and writers that predate
--                  this column); shows no badge so existing products aren't
--                  suddenly covered in warnings. Fills in as rows are re-saved.
--
-- No column DEFAULT on purpose: the app sets the value explicitly on every
-- save path, and NULL-means-unknown keeps this migration idempotent (a
-- DEFAULT would stamp legacy rows and need a non-rerunnable reset).
--
-- Idempotent: safe to run more than once.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS match_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_match_status_check'
      AND conrelid = 'public.product_materials'::regclass
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT product_materials_match_status_check
      CHECK (match_status IS NULL OR match_status IN ('verified', 'auto_matched', 'needs_review'));
  END IF;
END $$;

COMMENT ON COLUMN public.product_materials.match_status IS
  'Emission factor provenance: verified (user picked/confirmed), auto_matched (software matched, awaiting confirmation), needs_review (no usable match). NULL = legacy row, unknown.';
