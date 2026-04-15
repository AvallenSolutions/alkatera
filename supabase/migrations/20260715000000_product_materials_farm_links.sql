-- ══════════════════════════════════════════════════════════════════════════
-- product_materials: link self-grown ingredients to arable fields & orchards
-- ══════════════════════════════════════════════════════════════════════════
--
-- Existing schema already has:
--   - vineyard_id uuid REFERENCES vineyards(id) ON DELETE SET NULL
--   - is_self_grown boolean NOT NULL DEFAULT false
--
-- This migration extends the self-grown link to the other two farm modules
-- (arable fields and orchards) so that products can source barley, fruit,
-- etc. from an internally-managed growing profile. The LCA calculator uses
-- these FKs to pull in field-level emissions and removals.
--
-- See also: `lib/product-lca-calculator.ts` — arable + orchard integration.

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS arable_field_id uuid REFERENCES public.arable_fields(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orchard_id uuid REFERENCES public.orchards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_materials_arable_field_id
  ON public.product_materials(arable_field_id)
  WHERE arable_field_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_materials_orchard_id
  ON public.product_materials(orchard_id)
  WHERE orchard_id IS NOT NULL;

COMMENT ON COLUMN public.product_materials.arable_field_id IS
  'Links a self-grown ingredient to the arable field it was harvested from. Used by the LCA calculator to pull field-level emissions from arable_growing_profiles.';

COMMENT ON COLUMN public.product_materials.orchard_id IS
  'Links a self-grown ingredient to the orchard it was harvested from. Used by the LCA calculator to pull field-level emissions from orchard_growing_profiles.';
