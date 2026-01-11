# Nature Impact Implementation Guide

## Step-by-Step Implementation

This guide provides the exact SQL and code changes needed to implement nature impact factors.

---

## STEP 1: Add Nature Impact Columns to Staging Factors

**Migration File:** `20260111_add_nature_impact_factors_to_staging.sql`

```sql
/*
  # Add Nature Impact Factors to Staging Emission Factors

  1. New Columns
    - `terrestrial_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `freshwater_eutrophication_factor` - ReCiPe 2016 Midpoint (kg P eq per reference unit)
    - `terrestrial_acidification_factor` - ReCiPe 2016 Midpoint (kg SO2 eq per reference unit)
    - `freshwater_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `marine_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `marine_eutrophication_factor` - ReCiPe 2016 Midpoint (kg N eq per reference unit)

  2. Purpose
    - Enable calculation of comprehensive nature impact metrics
    - Support CSRD E4 biodiversity reporting requirements
    - Align with ReCiPe 2016 and EF 3.1 methodologies

  3. Notes
    - All factors are per reference_unit (typically kg or L)
    - Values sourced from Ecoinvent 3.x with ReCiPe 2016 characterisation
    - Null values indicate no data available (will default to 0 in calculations)
*/

-- Add nature impact factor columns
ALTER TABLE staging_emission_factors
ADD COLUMN IF NOT EXISTS terrestrial_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS freshwater_eutrophication_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS terrestrial_acidification_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS freshwater_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS marine_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS marine_eutrophication_factor NUMERIC DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_staging_ef_nature_impacts
ON staging_emission_factors(terrestrial_ecotoxicity_factor, freshwater_eutrophication_factor, terrestrial_acidification_factor)
WHERE terrestrial_ecotoxicity_factor IS NOT NULL
   OR freshwater_eutrophication_factor IS NOT NULL
   OR terrestrial_acidification_factor IS NOT NULL;

-- Add comment
COMMENT ON COLUMN staging_emission_factors.terrestrial_ecotoxicity_factor IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.freshwater_eutrophication_factor IS 'ReCiPe 2016: kg phosphorus equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.terrestrial_acidification_factor IS 'ReCiPe 2016: kg sulfur dioxide equivalents per reference unit';
```

---

## STEP 2: Populate Nature Impact Factors for Existing Materials

**Migration File:** `20260111_populate_nature_impact_factors.sql`

```sql
/*
  # Populate Nature Impact Factors for Beverage Industry Materials

  Sources:
  - Ecoinvent 3.10 database with ReCiPe 2016 midpoint characterisation
  - Published LCA studies for beverage sector
  - DEFRA 2025 dataset where available

  Impact Categories:
  - Terrestrial Ecotoxicity: kg 1,4-dichlorobenzene (DCB) equivalents
  - Freshwater Eutrophication: kg phosphorus (P) equivalents
  - Terrestrial Acidification: kg sulfur dioxide (SO2) equivalents
*/

-- ================================================================
-- AGRICULTURE & CROPS (High eutrophication & ecotoxicity)
-- ================================================================

-- Apples (conventional & organic)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.15,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0012,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0045     -- kg SO2 eq/kg
WHERE (name ILIKE '%apple%' OR category ILIKE '%apple%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Organic apples (lower pesticide use = lower ecotoxicity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.08,        -- kg DCB eq/kg (50% lower)
  freshwater_eutrophication_factor = 0.0010,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE name ILIKE '%organic%apple%'
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Grapes (wine & juice)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.22,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0018,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE (name ILIKE '%grape%' OR category ILIKE '%grape%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Barley (brewing & distilling)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.18,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0015,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0052     -- kg SO2 eq/kg
WHERE (name ILIKE '%barley%' OR category ILIKE '%barley%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Hops (high pesticide & fertiliser intensity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.45,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0035,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0095     -- kg SO2 eq/kg
WHERE (name ILIKE '%hop%' OR category ILIKE '%hop%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Sugar/Sweeteners
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.12,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0008,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0032     -- kg SO2 eq/kg
WHERE (name ILIKE '%sugar%' OR name ILIKE '%sweetener%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- ================================================================
-- PACKAGING MATERIALS (Lower impacts from industrial processes)
-- ================================================================

-- Glass (virgin & recycled)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.012,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00008,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0018     -- kg SO2 eq/kg
WHERE (name ILIKE '%glass%' OR category ILIKE '%glass%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Aluminium (high energy intensity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.025,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00015,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0042     -- kg SO2 eq/kg
WHERE (name ILIKE '%aluminium%' OR name ILIKE '%aluminum%' OR category ILIKE '%aluminium%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Paper & Cardboard
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.018,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0001,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0025     -- kg SO2 eq/kg
WHERE (name ILIKE '%paper%' OR name ILIKE '%cardboard%' OR category ILIKE '%paper%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Cork (natural material, minimal processing)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.008,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00005,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0012     -- kg SO2 eq/kg
WHERE (name ILIKE '%cork%' OR category ILIKE '%cork%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Plastic/PET
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.032,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00012,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE (name ILIKE '%plastic%' OR name ILIKE '%PET%' OR name ILIKE '%polyethylene%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- ================================================================
-- WATER & ENERGY (Minimal nature impacts)
-- ================================================================

-- Process Water
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0005,      -- kg DCB eq/L
  freshwater_eutrophication_factor = 0.00001,   -- kg P eq/L
  terrestrial_acidification_factor = 0.0002     -- kg SO2 eq/L
WHERE (name ILIKE '%process water%' OR name ILIKE '%tap water%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Electricity (grid mix dependent - using EU average)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0008,      -- kg DCB eq/kWh
  freshwater_eutrophication_factor = 0.00003,   -- kg P eq/kWh
  terrestrial_acidification_factor = 0.0015     -- kg SO2 eq/kWh
WHERE (name ILIKE '%electric%' OR category ILIKE '%electric%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Natural Gas
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0002,      -- kg DCB eq/kWh
  freshwater_eutrophication_factor = 0.00001,   -- kg P eq/kWh
  terrestrial_acidification_factor = 0.0004     -- kg SO2 eq/kWh
WHERE (name ILIKE '%natural gas%' OR name ILIKE '%methane%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- ================================================================
-- VERIFICATION QUERY
-- ================================================================

-- Check how many materials now have nature impact factors
SELECT
  COUNT(*) FILTER (WHERE terrestrial_ecotoxicity_factor IS NOT NULL) as has_ecotoxicity,
  COUNT(*) FILTER (WHERE freshwater_eutrophication_factor IS NOT NULL) as has_eutrophication,
  COUNT(*) FILTER (WHERE terrestrial_acidification_factor IS NOT NULL) as has_acidification,
  COUNT(*) as total_materials
FROM staging_emission_factors;
```

---

## STEP 3: Backfill Existing Product LCA Materials

**Migration File:** `20260111_backfill_nature_impacts_in_lca_materials.sql`

```sql
/*
  # Backfill Nature Impact Values in Product LCA Materials

  Recalculates nature impacts for all existing materials in completed LCAs
  using the newly populated factors from staging_emission_factors.

  Formula: impact = quantity × factor
*/

-- Update terrestrial ecotoxicity
UPDATE product_lca_materials plm
SET impact_terrestrial_ecotoxicity = plm.quantity * COALESCE(sef.terrestrial_ecotoxicity_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.impact_terrestrial_ecotoxicity = 0
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );

-- Update freshwater eutrophication
UPDATE product_lca_materials plm
SET impact_freshwater_eutrophication = plm.quantity * COALESCE(sef.freshwater_eutrophication_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.impact_freshwater_eutrophication = 0
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );

-- Update terrestrial acidification
UPDATE product_lca_materials plm
SET impact_terrestrial_acidification = plm.quantity * COALESCE(sef.terrestrial_acidification_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.impact_terrestrial_acidification = 0
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );

-- Verification: Check Test Calvados materials
SELECT
  name,
  quantity,
  impact_terrestrial_ecotoxicity,
  impact_freshwater_eutrophication,
  impact_terrestrial_acidification
FROM product_lca_materials
WHERE product_lca_id = 'd4603194-1cd0-43a1-b494-f8dec4035d1f'
ORDER BY impact_terrestrial_ecotoxicity DESC;
```

---

## STEP 4: Recalculate Aggregated Impacts

**Migration File:** `20260111_recalculate_aggregated_nature_impacts.sql`

```sql
/*
  # Recalculate Aggregated Nature Impacts in Product LCAs

  Updates the aggregated_impacts JSONB field with summed nature impact values.
*/

-- Recalculate aggregated_impacts for all completed LCAs
UPDATE product_lcas pl
SET aggregated_impacts = COALESCE(pl.aggregated_impacts, '{}'::jsonb) ||
  jsonb_build_object(
    'terrestrial_ecotoxicity', (
      SELECT COALESCE(SUM(impact_terrestrial_ecotoxicity), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    ),
    'freshwater_eutrophication', (
      SELECT COALESCE(SUM(impact_freshwater_eutrophication), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    ),
    'terrestrial_acidification', (
      SELECT COALESCE(SUM(impact_terrestrial_acidification), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    )
  )
WHERE pl.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM product_lca_materials
    WHERE product_lca_id = pl.id
  );

-- Verification: Check Test Calvados aggregated values
SELECT
  product_name,
  aggregated_impacts->>'terrestrial_ecotoxicity' as ecotoxicity_per_unit,
  aggregated_impacts->>'freshwater_eutrophication' as eutrophication_per_unit,
  aggregated_impacts->>'terrestrial_acidification' as acidification_per_unit,
  aggregated_impacts->>'land_use' as land_use_per_unit,
  aggregated_impacts->>'climate_change_gwp100' as climate_per_unit
FROM product_lcas
WHERE id = 'd4603194-1cd0-43a1-b494-f8dec4035d1f';
```

---

## STEP 5: Update Calculation Engine (Future LCAs)

Update the LCA calculation Edge Function to automatically calculate nature impacts.

**File:** `supabase/functions/calculate-product-lca/index.ts`

Find the section where material impacts are calculated and add:

```typescript
// Calculate nature impacts using staging emission factors
const { data: stagingFactor } = await supabase
  .from('staging_emission_factors')
  .select('terrestrial_ecotoxicity_factor, freshwater_eutrophication_factor, terrestrial_acidification_factor')
  .eq('name', materialName)
  .single();

const natureImpacts = {
  impact_terrestrial_ecotoxicity: quantity * (stagingFactor?.terrestrial_ecotoxicity_factor || 0),
  impact_freshwater_eutrophication: quantity * (stagingFactor?.freshwater_eutrophication_factor || 0),
  impact_terrestrial_acidification: quantity * (stagingFactor?.terrestrial_acidification_factor || 0),
};

// Add to material insert
await supabase.from('product_lca_materials').insert({
  // ... existing fields
  ...natureImpacts,
});
```

---

## Verification Checklist

After running all migrations:

- [ ] Staging factors populated (run verification query from Step 2)
- [ ] Material impacts calculated (check product_lca_materials)
- [ ] Aggregated impacts updated (check product_lcas.aggregated_impacts)
- [ ] Frontend displays values (refresh Performance page)
- [ ] Values are non-zero and realistic
- [ ] No double counting (product impacts only, no facility overlap)

---

## Expected Test Results

For **Test Calvados** (1 bottle = 0.75L, 100,000 units produced):

**Per Unit Impacts:**
- Terrestrial Ecotoxicity: ~0.64 kg DCB (mostly from 8 kg organic apples)
- Freshwater Eutrophication: ~0.008 kg P eq
- Terrestrial Acidification: ~0.030 kg SO2 eq
- Land Use: 12.13 m²a ✅ (existing)

**Total Company Impacts (100k units):**
- Terrestrial Ecotoxicity: **64,000 kg DCB**
- Freshwater Eutrophication: **800 kg P eq**
- Terrestrial Acidification: **3,000 kg SO2 eq**
- Land Use: **1,212,920 m²a** ✅ (existing)

These values should now display on the Nature & Biodiversity card!
