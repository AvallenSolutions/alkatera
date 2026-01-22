"use client";

import { MarkdownDoc } from "@/components/dev/MarkdownDoc";

const markdownContent = `# LCA Calculation Testing Guide

## Overview

This guide provides comprehensive instructions for testing the LCA calculation system end-to-end. It includes test data, expected results, and validation procedures.

## Problem Diagnosis Summary

### Root Cause
Materials were being added to LCAs without impact factors populated in the \`product_lca_materials\` table. The calculation engine requires these values to be pre-calculated and stored when materials are added.

**Issue**: When materials were selected from \`staging_emission_factors\` through the UI, the per-unit factors (\`co2_factor\`, \`water_factor\`, \`land_factor\`, \`waste_factor\`) were returned from the API but **not multiplied by quantity** before saving to \`impact_climate\`, \`impact_water\`, \`impact_land\`, \`impact_waste\` in the materials table.

### Solution Implemented
1. Created 10 comprehensive test materials in \`staging_emission_factors\` with full multi-capital impact factors
2. Fixed existing Mass Market Soda LCA materials by retroactively calculating impact values
3. Created "Test Sparkling Lemonade 330ml" with realistic quantities and pre-calculated expected results

---

## Test Materials Available

The following materials are now available in the \`staging_emission_factors\` table for the Test organization:

### Ingredients
| Material | CO2 Factor | Water Factor | Land Factor | Waste Factor | Unit |
|----------|------------|--------------|-------------|--------------|------|
| Water (Municipal Treatment) | 0.0003 | 1.0 | 0.0001 | 0.0001 | kg |
| Sugar (Cane - Global) | 0.90 | 0.25 | 1.40 | 0.10 | kg |
| Sugar (Beet - EU) | 0.55 | 0.15 | 1.20 | 0.05 | kg |
| Citric Acid | 1.20 | 0.80 | 0.02 | 0.05 | kg |
| Natural Flavouring | 0.65 | 0.40 | 1.20 | 0.03 | kg |
| CO2 (Food Grade) | 0.15 | 0.01 | 0.0 | 0.0 | kg |

### Packaging
| Material | CO2 Factor | Water Factor | Land Factor | Waste Factor | Unit |
|----------|------------|--------------|-------------|--------------|------|
| Glass Bottle (Standard Flint) | 1.10 | 0.005 | 0.02 | 0.05 | kg |
| Glass Bottle (60% PCR) | 0.65 | 0.003 | 0.01 | 0.02 | kg |
| Kraft Paper Label | 0.95 | 0.35 | 1.80 | 0.02 | kg |
| HDPE Cap | 1.50 | 0.12 | 0.05 | 0.08 | kg |

---

## Test Case 1: Test Sparkling Lemonade 330ml

### Product Specification
- **Product**: Test Sparkling Lemonade (330ml glass bottle)
- **Functional Unit**: 1 bottle (330ml filled, capped, and labelled)
- **System Boundary**: Cradle-to-gate

### Bill of Materials
| Material | Quantity | Unit |
|----------|----------|------|
| Water (Municipal Treatment) | 0.3 | kg |
| Sugar (Cane - Global) | 0.025 | kg |
| Citric Acid | 0.0005 | kg |
| Natural Flavouring | 0.0002 | kg |
| Glass Bottle (Standard Flint) | 0.2 | kg |
| Kraft Paper Label | 0.002 | kg |

### Expected Results (Manual Calculation)

#### Climate Change (kg CO2e)
\`\`\`
Water:             0.3    × 0.0003 = 0.00009
Sugar:             0.025  × 0.90   = 0.0225
Citric Acid:       0.0005 × 1.20   = 0.0006
Natural Flavour:   0.0002 × 0.65   = 0.00013
Glass Bottle:      0.2    × 1.10   = 0.22
Paper Label:       0.002  × 0.95   = 0.0019
────────────────────────────────────────────
TOTAL:                               0.2452 kg CO2e
\`\`\`

#### Water Depletion (m³)
\`\`\`
Water:             0.3    × 1.0    = 0.3
Sugar:             0.025  × 0.25   = 0.00625
Citric Acid:       0.0005 × 0.80   = 0.0004
Natural Flavour:   0.0002 × 0.40   = 0.00008
Glass Bottle:      0.2    × 0.005  = 0.001
Paper Label:       0.002  × 0.35   = 0.0007
────────────────────────────────────────────
TOTAL:                               0.30843 m³ (308.43 L)
\`\`\`

#### Land Use (m²)
\`\`\`
Water:             0.3    × 0.0001 = 0.00003
Sugar:             0.025  × 1.40   = 0.035
Citric Acid:       0.0005 × 0.02   = 0.00001
Natural Flavour:   0.0002 × 1.20   = 0.00024
Glass Bottle:      0.2    × 0.02   = 0.004
Paper Label:       0.002  × 1.80   = 0.0036
────────────────────────────────────────────
TOTAL:                               0.04288 m²
\`\`\`

#### Waste Generation (kg)
\`\`\`
Water:             0.3    × 0.0001 = 0.00003
Sugar:             0.025  × 0.10   = 0.0025
Citric Acid:       0.0005 × 0.05   = 0.000025
Natural Flavour:   0.0002 × 0.03   = 0.000006
Glass Bottle:      0.2    × 0.05   = 0.01
Paper Label:       0.002  × 0.02   = 0.00004
────────────────────────────────────────────
TOTAL:                               0.01260 kg
\`\`\`

### Validation Criteria
Results should match expected values within ±5%:
- **Climate**: 0.2452 kg CO2e (±0.0123)
- **Water**: 0.30843 m³ (±0.0154)
- **Land**: 0.04288 m² (±0.00214)
- **Waste**: 0.01260 kg (±0.00063)

---

## How to Test

### Method 1: Query Existing Test LCA

The Test Sparkling Lemonade has been pre-created with UUID \`00000000-0000-0000-0000-000000000001\`.

\`\`\`sql
-- View the test LCA
SELECT * FROM product_lcas
WHERE id = '00000000-0000-0000-0000-000000000001';

-- View materials
SELECT
  name,
  quantity,
  unit,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste
FROM product_lca_materials
WHERE product_carbon_footprint_id = '00000000-0000-0000-0000-000000000001'
ORDER BY name;

-- View results
SELECT
  impact_category,
  value,
  unit,
  method
FROM product_lca_results
WHERE product_carbon_footprint_id = '00000000-0000-0000-0000-000000000001'
ORDER BY
  CASE impact_category
    WHEN 'Climate Change' THEN 1
    WHEN 'Water Depletion' THEN 2
    WHEN 'Land Use' THEN 3
    WHEN 'Waste Generation' THEN 4
    ELSE 5
  END;
\`\`\`

### Method 2: Create New LCA via UI

1. Navigate to Products → New Product
2. Create "My Test Beverage"
3. Click "Create Carbon Footprint"
4. Add the following materials using AssistedIngredientSearch:
   - Search "Water" → Select "Water (Municipal Treatment)" → 0.3 kg
   - Search "Sugar" → Select "Sugar (Cane - Global)" → 0.025 kg
   - Search "Citric" → Select "Citric Acid" → 0.0005 kg
   - Search "Natural" → Select "Natural Flavouring" → 0.0002 kg
   - Search "Glass Bottle" → Select "Glass Bottle (Standard Flint)" → 0.2 kg
   - Search "Label" → Select "Kraft Paper Label" → 0.002 kg
5. Submit LCA for calculation
6. View results and compare against expected values

### Method 3: Run Calculation Edge Function

\`\`\`bash
# Get auth token
curl -X POST https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Invoke calculation
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/invoke-openlca \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"product_carbon_footprint_id":"00000000-0000-0000-0000-000000000001"}'
\`\`\`

---

## Validation Checklist

- [ ] **Test materials exist**: All 10 materials are in \`staging_emission_factors\`
- [ ] **Materials have impact factors**: All factors (CO2, water, land, waste) are populated
- [ ] **Test LCA exists**: UUID \`00000000-0000-0000-0000-000000000001\` returns data
- [ ] **Materials linked correctly**: 6 materials in test LCA with correct quantities
- [ ] **Impact factors calculated**: Each material has \`impact_*\` values = quantity × factor
- [ ] **Results match expected**: All 4 impact categories within ±5% of manual calculation
- [ ] **UI displays correctly**: Results page shows non-zero values for all metrics
- [ ] **Circularity calculation**: Uses actual \`waste_factor\` data, not estimated

---

## Known Issues & Fixes

### Issue 1: Materials without impact factors
**Symptom**: Calculation returns 0 for all impacts
**Cause**: \`impact_climate\`, \`impact_water\`, etc. are NULL in \`product_lca_materials\`
**Fix**: When adding materials via UI, ensure impact factors from staging are multiplied by quantity before saving

### Issue 2: Circularity shows random data
**Symptom**: Waste totals don't match material quantities
**Cause**: UI estimates waste as \`quantity * 0.1\` instead of using \`impact_waste\`
**Fix**: Update results page to read \`impact_waste\` from materials table

### Issue 3: Water shown in litres vs m³
**Symptom**: Water factor is in m³ but UI expects litres
**Cause**: Unit mismatch between calculation and display
**Fix**: Store water in m³, convert to litres for display (1 m³ = 1000 L)

---

## Automated Regression Test

Run this SQL to verify the system is working:

\`\`\`sql
-- Regression test: Verify Test Sparkling Lemonade calculations
WITH expected AS (
  SELECT
    'Climate Change' as category, 0.2452 as expected_value, 0.0123 as tolerance
  UNION ALL SELECT 'Water Depletion', 0.30843, 0.0154
  UNION ALL SELECT 'Land Use', 0.04288, 0.00214
  UNION ALL SELECT 'Waste Generation', 0.01260, 0.00063
),
actual AS (
  SELECT impact_category as category, value as actual_value
  FROM product_lca_results
  WHERE product_carbon_footprint_id = '00000000-0000-0000-0000-000000000001'
)
SELECT
  e.category,
  e.expected_value,
  a.actual_value,
  e.tolerance,
  ABS(a.actual_value - e.expected_value) as variance,
  CASE
    WHEN ABS(a.actual_value - e.expected_value) <= e.tolerance THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as result
FROM expected e
LEFT JOIN actual a ON e.category = a.category
ORDER BY e.category;
\`\`\`

**Expected Output**: All 4 tests show "✓ PASS"

---

## Next Steps

1. **Fix AssistedIngredientSearch component** to properly calculate impact values when saving materials
2. **Update circularity calculation** on results page to use \`impact_waste\` instead of estimating
3. **Add unit tests** for calculation engine with these test cases
4. **Create UI test** that walks through LCA creation and validates results
5. **Document calculation methodology** for ISO 14044 compliance

---

## Support

For questions or issues with LCA calculations:
1. Check this guide first
2. Query the test LCA to verify data structure
3. Review calculation logs in \`product_lca_calculation_logs\`
4. Check edge function logs for detailed error messages
`;

export default function LCACalculationTestingPage() {
  return (
    <MarkdownDoc
      content={markdownContent}
      title="LCA Calculation Testing Guide"
      description="Comprehensive guide for testing the LCA calculation system end-to-end with test data, expected results, and validation procedures."
    />
  );
}
