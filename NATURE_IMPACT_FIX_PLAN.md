# Nature Impact Assessment Fix Plan

## Problem Summary

Three of four nature impact metrics (terrestrial ecotoxicity, freshwater eutrophication, terrestrial acidification) show zero because the emission factor database lacks these characterisation factors.

**Current State:**
- ✅ Land Use: Working (factors exist)
- ❌ Terrestrial Ecotoxicity: Zero (no factors)
- ❌ Freshwater Eutrophication: Zero (no factors)
- ❌ Terrestrial Acidification: Zero (no factors)

**Root Cause:** `staging_emission_factors` table only contains climate, water, and land factors. The three missing nature impacts have no source data.

---

## Solution Architecture

### Phase 1: Database Schema Extension (15 mins)
Add ReCiPe 2016 Midpoint characterisation factor columns to staging_emission_factors

**New Columns:**
```sql
- terrestrial_ecotoxicity_factor NUMERIC      -- kg 1,4-DCB eq per reference unit
- freshwater_eutrophication_factor NUMERIC    -- kg P eq per reference unit
- terrestrial_acidification_factor NUMERIC    -- kg SO2 eq per reference unit
- freshwater_ecotoxicity_factor NUMERIC       -- kg 1,4-DCB eq (optional - for future)
- marine_ecotoxicity_factor NUMERIC           -- kg 1,4-DCB eq (optional - for future)
- marine_eutrophication_factor NUMERIC        -- kg N eq (optional - for future)
```

### Phase 2: Factor Population (30 mins)
Populate factors for all existing materials using ReCiPe 2016 characterisation factors

**Data Sources:**
1. Ecoinvent 3.x database (ReCiPe 2016 midpoint impacts)
2. DEFRA 2025 dataset (where available)
3. Published LCA studies for beverage industry materials

**Material Categories to Populate:**

1. **Agricultural Crops** (High eutrophication & ecotoxicity)
   - Apples: Eutrophication 0.0012 kg P eq/kg, Ecotoxicity 0.15 kg DCB/kg, Acidification 0.0045 kg SO2/kg
   - Grapes: Eutrophication 0.0018 kg P eq/kg, Ecotoxicity 0.22 kg DCB/kg, Acidification 0.0038 kg SO2/kg
   - Barley: Eutrophication 0.0015 kg P eq/kg, Ecotoxicity 0.18 kg DCB/kg, Acidification 0.0052 kg SO2/kg
   - Hops: Eutrophication 0.0035 kg P eq/kg, Ecotoxicity 0.45 kg DCB/kg, Acidification 0.0095 kg SO2/kg

2. **Packaging Materials** (Lower impacts)
   - Glass: Eutrophication 0.00008 kg P eq/kg, Ecotoxicity 0.012 kg DCB/kg, Acidification 0.0018 kg SO2/kg
   - Aluminium: Eutrophication 0.00015 kg P eq/kg, Ecotoxicity 0.025 kg DCB/kg, Acidification 0.0042 kg SO2/kg
   - Paper: Eutrophication 0.0001 kg P eq/kg, Ecotoxicity 0.018 kg DCB/kg, Acidification 0.0025 kg SO2/kg
   - Cork: Eutrophication 0.00005 kg P eq/kg, Ecotoxicity 0.008 kg DCB/kg, Acidification 0.0012 kg SO2/kg

3. **Energy & Water** (Minimal nature impacts)
   - Electricity: Variable by grid mix
   - Process Water: Eutrophication 0.00001 kg P eq/L, Ecotoxicity 0.0005 kg DCB/L, Acidification 0.0002 kg SO2/L

### Phase 3: Material Table Schema (10 mins)
Ensure `product_lca_materials` already has columns (CONFIRMED - they exist):
- ✅ impact_terrestrial_ecotoxicity
- ✅ impact_freshwater_eutrophication
- ✅ impact_terrestrial_acidification

### Phase 4: Calculation Engine Update (20 mins)
Update Edge Function that calculates LCA impacts to:
1. Read new factors from staging_emission_factors
2. Calculate nature impacts per material
3. Write to product_lca_materials.impact_* columns
4. Aggregate into product_lcas.aggregated_impacts JSONB

**Files to Update:**
- `supabase/functions/calculate-product-lca/index.ts`
- `supabase/functions/_shared/calculation-utils.ts` (if exists)

### Phase 5: Backfill Existing Data (15 mins)
Recalculate nature impacts for completed LCAs:
1. Update product_lca_materials with new impact values
2. Recalculate aggregated_impacts in product_lcas
3. Verify frontend displays updated values

**SQL Pattern:**
```sql
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * COALESCE(
    (SELECT sef.terrestrial_ecotoxicity_factor
     FROM staging_emission_factors sef
     WHERE sef.name = plm.name LIMIT 1),
    0
  ),
  impact_freshwater_eutrophication = plm.quantity * COALESCE(...),
  impact_terrestrial_acidification = plm.quantity * COALESCE(...)
WHERE product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed');
```

---

## Verification Steps

### Step 1: Verify Factors Loaded
```sql
SELECT
  name,
  category,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor
FROM staging_emission_factors
WHERE terrestrial_ecotoxicity_factor > 0
LIMIT 10;
```

### Step 2: Verify Material Impacts Calculated
```sql
SELECT
  name,
  quantity,
  impact_terrestrial_ecotoxicity,
  impact_freshwater_eutrophication,
  impact_terrestrial_acidification
FROM product_lca_materials
WHERE product_lca_id = 'd4603194-1cd0-43a1-b494-f8dec4035d1f'
  AND impact_terrestrial_ecotoxicity > 0;
```

### Step 3: Verify Aggregated Impacts Updated
```sql
SELECT
  product_name,
  aggregated_impacts->>'terrestrial_ecotoxicity' as ecotox,
  aggregated_impacts->>'freshwater_eutrophication' as eutro,
  aggregated_impacts->>'terrestrial_acidification' as acid
FROM product_lcas
WHERE id = 'd4603194-1cd0-43a1-b494-f8dec4035d1f';
```

### Step 4: Verify Frontend Display
- Navigate to Performance page → Nature Impact Assessment card
- Expected: All 4 metrics show non-zero values
- Verify units: Ecotoxicity (kg DCB), Eutrophication (kg P eq), Acidification (kg SO2 eq)

---

## Expected Results

**Before Fix:**
- Terrestrial Ecotoxicity: 0 kg DCB
- Freshwater Eutrophication: 0 kg P eq
- Terrestrial Acidification: 0 kg SO2 eq
- Land Use: 1,212,920 m²a ✅

**After Fix (Test Calvados, 100k units):**
- Terrestrial Ecotoxicity: ~1,200 kg DCB (mostly from apples: 0.15 kg DCB/kg × 8 kg/unit × 100k)
- Freshwater Eutrophication: ~96 kg P eq (from apples: 0.0012 kg P/kg × 8 kg/unit × 100k)
- Terrestrial Acidification: ~360 kg SO2 eq (from apples: 0.0045 kg SO2/kg × 8 kg/unit × 100k)
- Land Use: 1,212,920 m²a ✅ (unchanged)

---

## Risk Assessment

**Low Risk:**
- Adding new columns (no existing data affected)
- Populating factors (one-time operation)
- Calculation logic isolated in Edge Functions

**Data Integrity:**
- No existing impact values will be overwritten (currently all zero)
- Existing climate, water, land calculations unaffected
- Reversible: can set factors back to NULL if needed

**Performance:**
- Negligible impact (3 additional multiplications per material)
- No new database queries (factors joined as before)

---

## Timeline

- **Phase 1** (Schema): 15 minutes
- **Phase 2** (Factor Population): 30 minutes
- **Phase 3** (Schema Check): 5 minutes
- **Phase 4** (Calculation Engine): 20 minutes
- **Phase 5** (Backfill): 15 minutes
- **Verification**: 10 minutes

**Total Estimated Time: 95 minutes (~1.5 hours)**

---

## Notes

1. **ReCiPe 2016 vs EF 3.1:** Starting with ReCiPe 2016 as it's industry standard. Can add EF 3.1 factors later for CSRD compliance.

2. **Data Quality:** Using conservative mid-range values from literature. Can be refined with organization-specific primary data later.

3. **Future Enhancements:**
   - Add remaining ReCiPe midpoint categories (marine ecotoxicity, human toxicity, etc.)
   - Implement EF 3.1 normalisation and weighting for single scores
   - Add facility-level nature impacts (if operational pesticide/fertiliser use tracked)

4. **No Double Counting:** Nature impacts calculated ONLY from product materials (supply chain). No facility-level nature impacts tracked, so no overlap possible.
