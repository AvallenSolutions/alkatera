-- Structured packaging identity for the guided packaging wizard.
--
-- Wizard-created rows store WHAT the packaging physically is in dedicated
-- columns instead of relying on keyword inference over the free-text
-- material_name (the inference that caused the 6x end-of-life inflation bug).
-- End-of-life resolution prefers container_material when present and only
-- falls back to name inference when it is null (manually-entered rows).
--
-- Idempotent: safe to run more than once.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS container_format text,
  ADD COLUMN IF NOT EXISTS container_material text,
  ADD COLUMN IF NOT EXISTS container_size_ml numeric,
  ADD COLUMN IF NOT EXISTS weight_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_weight_source_check'
      AND conrelid = 'public.product_materials'::regclass
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT product_materials_weight_source_check
      CHECK (weight_source IS NULL OR weight_source IN ('measured', 'typical', 'estimated'));
  END IF;
END $$;

COMMENT ON COLUMN public.product_materials.container_format IS
  'Structured packaging format from the guided wizard (bottle, can, keg, carton, pouch, bag_in_box). Null for manually-entered rows.';
COMMENT ON COLUMN public.product_materials.container_material IS
  'Structured material identity from the guided wizard (glass, aluminium, pet, hdpe, steel, paperboard, cork, plastic_laminate, bib_composite, paper). End-of-life factor resolution prefers this over name inference.';
COMMENT ON COLUMN public.product_materials.container_size_ml IS
  'Container capacity in millilitres, when chosen in the guided wizard.';
COMMENT ON COLUMN public.product_materials.weight_source IS
  'Provenance of net_weight_g: measured (user weighed it), typical (catalogue median accepted), estimated (user guess).';
