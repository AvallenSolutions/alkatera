# Bolt V2 Fix Prompt: Product LCA Calculation System

## Context

You are working on an LCA (Life Cycle Assessment) platform for calculating product carbon footprints. The current implementation has critical bugs in the file:

**`supabase/functions/calculate-product-lca-impacts/index.ts`**

This Edge Function aggregates material-level impacts into a product-level LCA report, but it's currently producing incorrect results.

---

## Critical Issues to Fix

The function is missing or has hardcoded values for:

1. **Scope 1, 2 & 3 emissions breakdown** - Currently ALL emissions are assigned to Scope 3, with Scope 1 and Scope 2 hardcoded to 0
2. **Lifecycle stage breakdown** - Processing, use phase, and end-of-life are hardcoded to 0
3. **Methane (CH4) emissions** - Hardcoded to 0, not tracked at all
4. **Nitrous Oxide (N2O) emissions** - Hardcoded to 0, not tracked at all
5. **GHG gas inventory** - No breakdown by gas type (CO2, CH4, N2O, HFCs)
6. **Fossil fuel usage tracking** - Not exposed in the breakdown

---

## Your Task

**Completely rewrite the aggregation logic in `supabase/functions/calculate-product-lca-impacts/index.ts` (lines 82-164) to:**

### 1. Calculate Scope 1, 2, & 3 Emissions Properly

**Scope Categorization Rules:**

- **Scope 1 (Direct emissions from owned/controlled sources):**
  - On-site fuel combustion (boilers, furnaces, vehicles)
  - Process emissions (fermentation, chemical reactions)
  - Fugitive emissions (refrigerant leaks, natural gas leaks)
  - Look for emission factors with category: 'Stationary Combustion', 'Mobile Combustion', 'Fugitive Emissions', 'Process Emissions'

- **Scope 2 (Indirect emissions from purchased energy):**
  - Purchased electricity
  - Purchased steam, heat, or cooling
  - Look for emission factors with category: 'Purchased Electricity', 'Purchased Heat/Steam'

- **Scope 3 (All other indirect emissions):**
  - Raw material extraction and production
  - Transportation and distribution
  - Packaging
  - Product use
  - End-of-life treatment
  - Everything else not in Scope 1 or 2

**Implementation Strategy:**

Query the `emissions_factors` table to understand which materials/activities fall into which scope. The `category` or `category_type` field should indicate the emission source type.

For materials without explicit scope assignment:
- Raw materials (ingredients) → Scope 3
- Packaging materials → Scope 3
- Transport → Scope 3
- Energy from facilities → Check if purchased (Scope 2) or self-generated (Scope 1)

### 2. Complete Lifecycle Stage Breakdown

**Lifecycle Stages:**

- **raw_materials:** Material extraction and production (already calculated as `ingredientClimate`)
- **processing:** Manufacturing, processing, assembly
  - Query production sites for energy consumption
  - Include process-specific emissions (fermentation, distillation, etc.)
  - Calculate from facility energy usage and process emission factors
- **packaging_stage:** Packaging material production (already calculated as `packagingClimate`)
- **distribution:** Transport and distribution (already calculated as `totalTransport`)
- **use_phase:** Product use emissions
  - For most food/beverage products, this is minimal or zero
  - For appliances, vehicles, etc., this would be significant
- **end_of_life:** Waste treatment, recycling, disposal
  - Calculate from waste factors and material end-of-life scenarios

**Data Sources:**
- For processing emissions: Query `product_lca_production_sites` joined with `facilities` to get energy consumption
- For end-of-life: Apply default waste treatment factors based on material types

### 3. Add Methane (CH4) and Nitrous Oxide (N2O) Tracking

**GHG Gas Inventory Structure:**

```typescript
by_ghg: {
  co2_fossil: number,      // kg CO2 from fossil sources
  co2_biogenic: number,    // kg CO2 from biogenic sources
  ch4: number,             // kg CH4 (NOT CO2e)
  n2o: number,             // kg N2O (NOT CO2e)
  hfc_pfc: number,         // kg CO2e from F-gases
}
```

**Implementation:**

1. Query `emissions_factors` table for CH4 and N2O emission factors
   - Look for factors with gas_type = 'CH4' or 'N2O'
   - Apply these factors to activities like:
     - Fermentation (produces CH4 and CO2)
     - Fertilizer application (produces N2O)
     - Wastewater treatment (produces CH4 and N2O)
     - Combustion (produces N2O)

2. For each material/activity:
   - Calculate CH4 emissions in kg CH4
   - Calculate N2O emissions in kg N2O
   - DO NOT convert to CO2e at this stage (report actual mass)

3. Sum up total CH4 and N2O emissions across all sources

4. The total climate impact already includes these gases converted to CO2e using IPCC GWP factors:
   - CH4 GWP = 27.9 (IPCC AR6)
   - N2O GWP = 273 (IPCC AR6)

**Verification:**
```typescript
// This should approximately equal totalClimate:
const verifyTotal =
  (co2_fossil + co2_biogenic) +
  (ch4 * 27.9) +
  (n2o * 273) +
  hfc_pfc;
```

### 4. Add Complete GHG Breakdown Structure

Add this to the `aggregatedImpacts` object:

```typescript
ghg_breakdown: {
  carbon_origin: {
    fossil: totalClimateFossil,
    biogenic: totalClimateBiogenic,
    land_use_change: totalClimateDluc,
  },
  gas_inventory: {
    co2_fossil: totalCO2Fossil,        // kg CO2 (calculated)
    co2_biogenic: totalCO2Biogenic,    // kg CO2 (calculated)
    methane: totalCH4,                 // kg CH4 (NEW - calculate this)
    nitrous_oxide: totalN2O,           // kg N2O (NEW - calculate this)
    hfc_pfc: totalHFCs,                // kg CO2e (NEW - calculate this)
  },
  gwp_factors: {
    methane_gwp100: 27.9,
    n2o_gwp100: 273,
    method: "IPCC AR6"
  }
}
```

### 5. Expose Fossil Fuel Usage

Add to breakdown:

```typescript
by_resource: {
  fossil_fuel_usage: totalFossilResourceScarcity,  // Already calculated, just expose it
  water_consumption: totalWater,
  land_occupation: totalLand,
}
```

---

## Implementation Guide

### Step 1: Enhance Data Fetching

Add queries to get additional data needed for proper categorization:

```typescript
// After fetching materials, also fetch:

// 1. Get emission factors for categorization
const { data: emissionFactors } = await supabaseClient
  .from('emissions_factors')
  .select('id, name, category, category_type, gas_type, gwp_factor, scope')
  .in('id', materials.map(m => m.data_source_id).filter(Boolean));

// 2. Get production site energy data (for Scope 1 & 2, processing stage)
const { data: productionSites } = await supabaseClient
  .from('product_lca_production_sites')
  .select(`
    *,
    facilities:facility_id (
      energy_consumption_kwh,
      fuel_consumption,
      renewable_energy_percentage
    )
  `)
  .eq('product_lca_id', product_lca_id);

// 3. Get facility emissions (Scope 1 & 2)
const { data: facilityEmissions } = await supabaseClient
  .from('ghg_emissions')
  .select('*')
  .in('facility_id', productionSites?.map(ps => ps.facility_id) || []);
```

### Step 2: Initialize Tracking Variables

```typescript
// Scope tracking
let scope1Emissions = 0;
let scope2Emissions = 0;
let scope3Emissions = 0;

// Lifecycle stage tracking
let processingEmissions = 0;
let usePhaseEmissions = 0;
let endOfLifeEmissions = 0;

// GHG gas inventory (mass, not CO2e)
let totalCH4 = 0;        // kg CH4
let totalN2O = 0;        // kg N2O
let totalHFCs = 0;       // kg CO2e
let totalCO2Fossil = 0;  // kg CO2
let totalCO2Biogenic = 0; // kg CO2
```

### Step 3: Categorize Material Emissions

For each material, determine its scope and lifecycle stage:

```typescript
for (const material of materials) {
  const climateImpact = Number(material.impact_climate || 0);
  const transportImpact = Number(material.impact_transport || 0);

  // Determine scope based on material type and data source
  let materialScope = 3; // Default to Scope 3

  // Check if this material is from a purchased energy source
  if (material.material_type === 'ENERGY') {
    if (material.energy_type === 'ELECTRICITY') {
      materialScope = 2; // Purchased electricity = Scope 2
      scope2Emissions += climateImpact;
    } else if (material.energy_type === 'FUEL') {
      materialScope = 1; // On-site fuel combustion = Scope 1
      scope1Emissions += climateImpact;
    }
  } else {
    // All material production and transport = Scope 3
    scope3Emissions += climateImpact + transportImpact;
  }

  // Extract GHG components if available
  // Check if material has CH4, N2O factors
  if (material.ch4_emission_factor && material.quantity) {
    totalCH4 += material.ch4_emission_factor * material.quantity;
  }

  if (material.n2o_emission_factor && material.quantity) {
    totalN2O += material.n2o_emission_factor * material.quantity;
  }

  // Continue with existing aggregation...
}
```

### Step 4: Add Production Site Emissions (Scope 1 & 2, Processing Stage)

```typescript
// Calculate processing emissions from production sites
if (productionSites && productionSites.length > 0) {
  for (const site of productionSites) {
    const facility = site.facilities;

    if (facility) {
      // Scope 2: Purchased electricity
      if (facility.energy_consumption_kwh) {
        const electricityFactor = 0.5; // kg CO2e/kWh (lookup from emissions_factors)
        const electricityEmissions = facility.energy_consumption_kwh * electricityFactor * (site.share_of_production / 100);
        scope2Emissions += electricityEmissions;
        processingEmissions += electricityEmissions;
      }

      // Scope 1: Fuel combustion
      if (facility.fuel_consumption) {
        const fuelFactor = 2.68; // kg CO2e/L diesel (lookup from emissions_factors)
        const fuelEmissions = facility.fuel_consumption * fuelFactor * (site.share_of_production / 100);
        scope1Emissions += fuelEmissions;
        processingEmissions += fuelEmissions;
      }
    }
  }
}
```

### Step 5: Calculate End-of-Life Emissions

```typescript
// Simple approach: Apply default waste treatment factors
for (const material of materials) {
  if (material.material_type === 'PACKAGING_MATERIAL') {
    // Assume 70% recycling, 30% landfill for packaging
    const wasteEmissionFactor = 0.05; // kg CO2e per kg material (lookup from emissions_factors)
    const endOfLifeImpact = material.quantity * wasteEmissionFactor * 0.3; // Only landfilled portion
    endOfLifeEmissions += endOfLifeImpact;
    scope3Emissions += endOfLifeImpact;
  }
}
```

### Step 6: Build Enhanced Breakdown

```typescript
const aggregatedImpacts = {
  climate_change_gwp100: totalCarbonFootprint,
  // ... other impact categories ...

  breakdown: {
    by_scope: {
      scope1: scope1Emissions,
      scope2: scope2Emissions,
      scope3: scope3Emissions,
    },
    by_lifecycle_stage: {
      raw_materials: ingredientClimate,
      processing: processingEmissions,
      packaging_stage: packagingClimate,
      distribution: totalTransport,
      use_phase: usePhaseEmissions,
      end_of_life: endOfLifeEmissions,
    },
    by_ghg: {
      co2_fossil: totalClimateFossil,
      co2_biogenic: totalClimateBiogenic,
      ch4: totalCH4,
      n2o: totalN2O,
      hfc_pfc: totalHFCs,
    },
    by_resource: {
      fossil_fuel_usage: totalFossilResourceScarcity,
      water_consumption: totalWater,
      land_occupation: totalLand,
    }
  },

  ghg_breakdown: {
    carbon_origin: {
      fossil: totalClimateFossil,
      biogenic: totalClimateBiogenic,
      land_use_change: totalClimateDluc,
    },
    gas_inventory: {
      co2_fossil: totalCO2Fossil,
      co2_biogenic: totalCO2Biogenic,
      methane: totalCH4,
      nitrous_oxide: totalN2O,
      hfc_pfc: totalHFCs,
    },
    gwp_factors: {
      methane_gwp100: 27.9,
      n2o_gwp100: 273,
      method: "IPCC AR6"
    }
  },

  // ... rest of existing fields ...
};
```

### Step 7: Add Validation

Before returning the result, validate the calculations:

```typescript
// Validation checks
const scopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
const lifecycleSum = ingredientClimate + processingEmissions + packagingClimate +
                     totalTransport + usePhaseEmissions + endOfLifeEmissions;

if (Math.abs(scopeSum - totalCarbonFootprint) > 0.01) {
  console.warn(`[calculate-product-lca-impacts] Scope sum mismatch: ${scopeSum} vs ${totalCarbonFootprint}`);
}

if (Math.abs(lifecycleSum - totalCarbonFootprint) > 0.01) {
  console.warn(`[calculate-product-lca-impacts] Lifecycle sum mismatch: ${lifecycleSum} vs ${totalCarbonFootprint}`);
}

// Verify GHG breakdown
const ghgSum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * 27.9) + (totalN2O * 273) + totalHFCs;
if (Math.abs(ghgSum - totalCarbonFootprint) > (totalCarbonFootprint * 0.05)) {
  console.warn(`[calculate-product-lca-impacts] GHG breakdown sum deviates >5% from total: ${ghgSum} vs ${totalCarbonFootprint}`);
}
```

---

## Key Constraints

1. **Do NOT modify the database schema** - All required fields already exist
2. **Maintain backward compatibility** - Existing LCA records should still work
3. **Use existing data sources** - Don't invent new tables, use what's available
4. **Follow ISO 14067 & GHG Protocol** - See migration file `20251128183507_add_ghg_breakdown_to_impact_metrics.sql` for compliance requirements
5. **Log all calculations** - Use console.log for debugging with clear labels

---

## Simplified Approach (If Full Implementation is Complex)

If implementing full Scope 1 & 2 tracking from production sites is too complex for now, use this simplified categorization:

**Minimum viable fix:**

1. **Scope categorization:**
   - Scope 1: 0 (acceptable for now if no facility data)
   - Scope 2: 0 (acceptable for now if no facility data)
   - Scope 3: All material + transport emissions (current behavior, but explicit)

2. **Lifecycle stages:**
   - raw_materials: ingredientClimate
   - **processing: Estimate as 10% of total** (placeholder until facility data integrated)
   - packaging_stage: packagingClimate
   - distribution: totalTransport
   - use_phase: 0 (correct for most products)
   - end_of_life: Estimate as 2% of packaging (placeholder)

3. **CH4 and N2O:**
   - If material has `ch4_emission_factor` field, use it
   - If material has `n2o_emission_factor` field, use it
   - Otherwise, estimate from total climate:
     - CH4: ~0.5% of total CO2e for agricultural products
     - N2O: ~1% of total CO2e for agricultural products
   - **Better to set to 0 with a TODO comment than to use incorrect estimates**

4. **GHG breakdown:**
   - Implement the structure even if some values are 0
   - Document what's missing with console.warn()

---

## Testing Instructions

After implementation, test with:

```sql
-- Query Test Calvados LCA results
SELECT
  product_name,
  aggregated_impacts->'breakdown'->'by_scope' as scopes,
  aggregated_impacts->'breakdown'->'by_lifecycle_stage' as lifecycle,
  aggregated_impacts->'breakdown'->'by_ghg' as ghg_gases,
  aggregated_impacts->'ghg_breakdown' as ghg_breakdown
FROM product_lcas
WHERE product_name ILIKE '%calvados%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- Scope 1 + Scope 2 + Scope 3 should equal total_carbon_footprint
- All lifecycle stages should sum to total_carbon_footprint
- CH4 and N2O should have non-zero values (unless truly zero for product)
- GHG breakdown structure should be present

---

## Success Criteria

✅ **The fix is complete when:**

1. Scope 1, 2, 3 are calculated (not hardcoded to 0)
2. Processing, use_phase, and end_of_life stages are calculated (not hardcoded to 0)
3. CH4 and N2O are tracked in the gas inventory
4. GHG breakdown structure is present in aggregated_impacts
5. Fossil fuel usage is exposed in breakdown
6. All breakdown sums validate against totals (within 5% tolerance)
7. Console logs show clear calculation steps for debugging
8. Test Calvados LCA shows realistic emissions distribution

---

## Additional Resources

- See `PRODUCT_LCA_CALCULATION_ISSUES_REPORT.md` for detailed bug analysis
- Reference migration: `supabase/migrations/20251128183507_add_ghg_breakdown_to_impact_metrics.sql`
- ISO 14067 compliance requirements documented in migration comments
- Existing validation function: `validate_ghg_breakdown()` in database

---

**Good luck! This is critical for the core functionality of the platform.**
