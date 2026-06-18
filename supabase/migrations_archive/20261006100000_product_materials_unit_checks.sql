-- Product materials: constrain quantity units to the shared vocabulary and
-- require units_per_group on shared packaging.
--
-- Why: product_materials.unit was free text and the calculator silently
-- treated unknown units as kilograms (10-1000x errors). The UI now binds all
-- unit inputs to lib/constants/material-units.ts; this migration normalises
-- legacy variants and adds a CHECK so free-text units can never come back.
-- Shared packaging (secondary/shipment/tertiary) saved without
-- units_per_group used to default to 1 in the calculator, over-counting the
-- pack's impact against every single product; new rows must carry an answer.
--
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight (informational): see what unit values exist today
--    SELECT unit, COUNT(*) FROM product_materials GROUP BY unit ORDER BY 2 DESC;
-- ---------------------------------------------------------------------------

-- 1. Normalise legacy unit variants to canonical values
UPDATE product_materials SET unit = lower(trim(unit))
WHERE unit IS NOT NULL AND unit <> lower(trim(unit));

UPDATE product_materials SET unit = 'kg'
WHERE unit IN ('kilogram', 'kilograms', 'kgs');

UPDATE product_materials SET unit = 'g'
WHERE unit IN ('gram', 'grams');

UPDATE product_materials SET unit = 'mg'
WHERE unit IN ('milligram', 'milligrams');

UPDATE product_materials SET unit = 't'
WHERE unit IN ('tonne', 'tonnes', 'metric_ton', 'metric_tons', 'metric ton', 'metric tons');

UPDATE product_materials SET unit = 'lb'
WHERE unit IN ('lbs', 'pound', 'pounds');

UPDATE product_materials SET unit = 'oz'
WHERE unit IN ('ounce', 'ounces');

UPDATE product_materials SET unit = 'l'
WHERE unit IN ('litre', 'litres', 'liter', 'liters');

UPDATE product_materials SET unit = 'ml'
WHERE unit IN ('millilitre', 'millilitres', 'milliliter', 'milliliters');

UPDATE product_materials SET unit = 'unit'
WHERE unit IN ('units', 'item', 'items', 'piece', 'pieces', 'each', 'ea', 'pcs');

-- 2. Constrain unit to the vocabulary (NOT VALID first so the ALTER cannot
--    fail mid-migration, then validate once the backfill above has run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_unit_vocabulary'
      AND conrelid = 'public.product_materials'::regclass
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT product_materials_unit_vocabulary
      CHECK (unit IS NULL OR unit IN ('kg', 'g', 'mg', 't', 'lb', 'oz', 'l', 'ml', 'unit'))
      NOT VALID;
  END IF;
END $$;

-- If this VALIDATE fails, some rows still carry an unexpected unit. Find them
-- with the pre-flight query above, map them in step 1, and re-run.
ALTER TABLE public.product_materials
  VALIDATE CONSTRAINT product_materials_unit_vocabulary;

-- 3. Shared packaging must say how many products share it. NOT VALID on
--    purpose and NOT validated: new and updated rows are enforced, legacy
--    rows keep working and are surfaced by the data-quality query below
--    (the recipe page now re-asks the question when units_per_group is null).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_shared_units_per_group'
      AND conrelid = 'public.product_materials'::regclass
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT product_materials_shared_units_per_group
      CHECK (
        packaging_category IS NULL
        OR packaging_category NOT IN ('secondary', 'shipment', 'tertiary')
        OR (units_per_group IS NOT NULL AND units_per_group >= 1)
      )
      NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Data quality follow-up (informational): legacy shared packaging rows whose
-- allocation is unknown and therefore over-counted as 1:1 until re-saved.
--
--   SELECT pm.id, p.name AS product, pm.material_name, pm.packaging_category
--   FROM product_materials pm
--   JOIN products p ON p.id = pm.product_id
--   WHERE pm.material_type = 'packaging'
--     AND pm.packaging_category IN ('secondary', 'shipment', 'tertiary')
--     AND (pm.units_per_group IS NULL OR pm.units_per_group < 1);
-- ---------------------------------------------------------------------------
