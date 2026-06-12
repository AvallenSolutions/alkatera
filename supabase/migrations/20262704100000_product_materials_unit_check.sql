-- ============================================================================
-- DEFERRED — DO NOT APPLY YET
--
-- Apply this ONLY after supabase/snippets/audit-product-material-units.sql
-- returns ZERO rows. Until then, legacy rows with free-text units exist and
-- this constraint would block updates to them; once applied it also blocks
-- any INSERT/UPDATE that writes a unit outside the canonical vocabulary in
-- lib/constants/material-units.ts.
-- ============================================================================

-- Idempotent: drop and recreate.
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_unit_check;

-- NOT VALID: enforces the rule for new/updated rows immediately without
-- scanning (or being blocked by) existing rows.
ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_unit_check
  CHECK (
    lower(trim(coalesce(unit, ''))) IN (
      -- canonical values
      'kg', 'g', 'mg', 't', 'lb', 'oz', 'l', 'ml', 'unit',
      -- aliases (legacy variants the calculator recognises)
      'kilogram', 'kilograms', 'kgs',
      'gram', 'grams',
      'milligram', 'milligrams',
      'tonne', 'tonnes', 'metric_ton', 'metric_tons', 'metric ton', 'metric tons',
      'lbs', 'pound', 'pounds',
      'ounce', 'ounces',
      'litre', 'litres', 'liter', 'liters',
      'millilitre', 'millilitres', 'milliliter', 'milliliters',
      'units', 'item', 'items', 'piece', 'pieces', 'each', 'ea', 'pcs'
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT product_materials_unit_check ON public.product_materials IS
  'Units must come from the canonical vocabulary in lib/constants/material-units.ts. Unknown units are treated as kg by the LCA calculator, silently corrupting footprints.';

-- After confirming the audit snippet returns zero rows, validate existing
-- data too (uncomment and run):
-- ALTER TABLE public.product_materials VALIDATE CONSTRAINT product_materials_unit_check;
