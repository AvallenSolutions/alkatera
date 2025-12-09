# Hybrid Data Model - Quick Start Guide

## ✅ Implementation Status

**Core system is COMPLETE and ready for testing!**

All database migrations applied ✓
Impact waterfall resolver enhanced ✓
Calculation engine updated ✓
Build successful ✓

---

## Testing the Hybrid System

### Test Scenario 1: UK Electricity (Hybrid Source)

**What it tests:** DEFRA GWP + Ecoinvent non-GWP hybrid approach

**Steps:**
1. Navigate to Products → Create New Product
2. Add material: "Electricity (Grid - UK)"
3. Quantity: 1000 kWh
4. Save and run calculation

**Expected Result:**
```
GWP: 233 kg CO2e (from DEFRA 2025)
Water: 40 m³ (from Ecoinvent)
Land: 1 m² (from Ecoinvent)
+ 15 other impact categories (from Ecoinvent)

Data Quality:
- is_hybrid_source: true
- gwp_data_source: "DEFRA 2025"
- non_gwp_data_source: "Ecoinvent 3.12"
- data_quality_grade: "MEDIUM"
- confidence_score: 80
```

**How to verify:**
- Check browser console for: `[Waterfall] ✓ Priority 2 SUCCESS: Hybrid (DEFRA GWP + Ecoinvent non-GWP)`
- Inspect aggregated_impacts in database
- Look for data_provenance.defra_gwp_count > 0

---

### Test Scenario 2: Manufacturing Material (Full Ecoinvent)

**What it tests:** Complete Ecoinvent dataset for ingredients

**Steps:**
1. Add material: "Sugar (Cane - Global)"
2. Quantity: 100 kg
3. Save and run calculation

**Expected Result:**
```
GWP: 90 kg CO2e (from Ecoinvent)
Water: 25 m³ (from Ecoinvent)
Land: 140 m² (from Ecoinvent)
+ All 18 impact categories (from Ecoinvent)

Data Quality:
- is_hybrid_source: false
- gwp_data_source: "Ecoinvent 3.12"
- non_gwp_data_source: "Ecoinvent 3.12"
- data_quality_grade: "MEDIUM"
- confidence_score: 50
```

**How to verify:**
- Check browser console for: `[Waterfall] ✓ Priority 3 SUCCESS: Using Ecoinvent proxy`
- Inspect material in product_lca_materials table
- Verify category_type = 'MANUFACTURING_MATERIAL'

---

### Test Scenario 3: Transport (Hybrid Source)

**What it tests:** DEFRA transport factors with Ecoinvent overlay

**Steps:**
1. Add material: "Transport (HGV Diesel)"
2. Quantity: 500 tkm (tonne-kilometres)
3. Save and run calculation

**Expected Result:**
```
GWP: 45 kg CO2e (from DEFRA 2025)
Particulate Matter: calculated (from Ecoinvent)
NOx: calculated (from Ecoinvent)
+ Other environmental impacts (from Ecoinvent)

Data Quality:
- is_hybrid_source: true
- category_type: 'SCOPE_3_TRANSPORT'
- defra_gwp_count: 1
```

---

### Test Scenario 4: Complete Product LCA

**What it tests:** Mixed portfolio with provenance tracking

**Product Recipe:**
- 1000 kg Sugar (Cane - Global)
- 500 L Water (Municipal)
- 2000 kWh Electricity (Grid - UK)
- 100 kg Glass Bottle (Virgin)
- 500 tkm Transport (HGV Diesel)

**Expected Provenance Summary:**
```json
{
  "data_provenance": {
    "hybrid_sources_count": 2,        // Electricity + Transport
    "defra_gwp_count": 2,              // Electricity + Transport
    "supplier_verified_count": 0,
    "ecoinvent_only_count": 3,         // Sugar, Water, Glass
    "methodology_summary": "DEFRA 2025 GHG factors (2 materials); Ecoinvent 3.12 full dataset (3 materials); Hybrid sources (2 materials)"
  }
}
```

**How to verify:**
- Run calculate-product-lca-impacts function
- Check aggregated_impacts.data_provenance
- Verify methodology_summary includes all sources
- Confirm all 18 impact categories are populated

---

## Inspection Queries

### View Material Provenance

```sql
SELECT
  name,
  quantity,
  unit,
  category_type,
  gwp_data_source,
  non_gwp_data_source,
  is_hybrid_source,
  data_quality_grade,
  confidence_score,
  impact_climate,
  impact_water,
  impact_land
FROM product_lca_materials
WHERE product_lca_id = 'YOUR_LCA_ID'
ORDER BY impact_climate DESC;
```

### View DEFRA-Ecoinvent Mappings

```sql
SELECT
  defra_factor_name,
  defra_category,
  ecoinvent_proxy_category,
  mapping_quality,
  geographic_alignment,
  confidence_score,
  notes
FROM defra_ecoinvent_impact_mappings
ORDER BY confidence_score DESC;
```

### View Complete Ecoinvent Proxies

```sql
SELECT
  material_category,
  material_name,
  impact_climate,
  impact_water,
  impact_land,
  impact_ozone_depletion,
  impact_particulate_matter,
  data_quality_score,
  geography
FROM ecoinvent_material_proxies
ORDER BY material_category;
```

### View LCA Provenance Summary

```sql
SELECT
  p.name AS product_name,
  pl.id AS lca_id,
  pl.aggregated_impacts->'data_provenance'->>'methodology_summary' AS methodology,
  pl.aggregated_impacts->'data_provenance'->>'hybrid_sources_count' AS hybrid_count,
  pl.aggregated_impacts->'data_provenance'->>'defra_gwp_count' AS defra_count,
  pl.aggregated_impacts->'climate_change_gwp100' AS total_gwp,
  pl.aggregated_impacts->'ozone_depletion' AS ozone_depletion,
  pl.aggregated_impacts->'particulate_matter' AS particulate_matter
FROM product_lcas pl
JOIN products p ON p.id = pl.product_id
WHERE pl.status = 'completed'
ORDER BY pl.created_at DESC
LIMIT 10;
```

---

## Console Logging

**Enable detailed waterfall logging:**

Open browser console and watch for:

```
[Waterfall] Resolving Electricity (Grid - UK) | Category: SCOPE_1_2_ENERGY | Quantity: 1000 kg
[Waterfall] Checking Priority 1 (Supplier) for: Electricity (Grid - UK)
[Waterfall] Attempting Priority 2 (DEFRA+Ecoinvent Hybrid) for: Electricity (Grid - UK)
[Waterfall] ✓ Priority 2 SUCCESS: Hybrid (DEFRA GWP + Ecoinvent non-GWP) for Electricity (Grid - UK)
```

**Calculation engine logging:**

```
[calculate-product-lca-impacts] Starting calculation for LCA: abc-123
[calculate-product-lca-impacts] Found 5 materials
[calculate-product-lca-impacts] Material 1: {...}
[calculate-product-lca-impacts] Calculated totals: {...}
```

---

## Verification Checklist

### Database Structure
- [ ] material_category_type enum exists
- [ ] product_lca_materials has category_type column
- [ ] product_lca_materials has gwp_data_source column
- [ ] product_lca_materials has non_gwp_data_source column
- [ ] product_lca_materials has is_hybrid_source column
- [ ] product_lca_materials has all 18 impact columns
- [ ] defra_ecoinvent_impact_mappings table exists
- [ ] 16 mappings populated in defra_ecoinvent_impact_mappings
- [ ] ecoinvent_material_proxies has all 18 impact columns

### Frontend Resolver
- [ ] resolveImpactFactors returns WaterfallResult with 18 categories
- [ ] detectMaterialCategory correctly identifies SCOPE_1_2_ENERGY
- [ ] detectMaterialCategory correctly identifies SCOPE_3_TRANSPORT
- [ ] detectMaterialCategory correctly identifies MANUFACTURING_MATERIAL
- [ ] Priority 2 (hybrid) activates for energy materials
- [ ] Priority 2 (hybrid) activates for transport materials
- [ ] Priority 3 (full Ecoinvent) used for manufacturing materials

### Calculation Engine
- [ ] Aggregates all 18 impact categories
- [ ] Tracks hybrid_sources_count correctly
- [ ] Tracks defra_gwp_count correctly
- [ ] Generates methodology_summary
- [ ] Includes data_provenance in aggregated_impacts
- [ ] GHG breakdown includes fossil, biogenic, dLUC

### Output Validation
- [ ] aggregated_impacts contains all 18 categories
- [ ] aggregated_impacts.data_provenance exists
- [ ] Material breakdown includes provenance info
- [ ] Confidence scores appropriate for data source
- [ ] Data quality grades match expectations

---

## Common Issues & Solutions

### Issue 1: No hybrid sources detected

**Symptom:** hybrid_sources_count = 0 when using electricity

**Solution:**
- Verify material name matches mapping: "Electricity (Grid - UK)"
- Check category_type is detected as SCOPE_1_2_ENERGY
- Confirm DEFRA mapping exists in database
- Review console logs for waterfall resolution path

### Issue 2: Missing impact categories

**Symptom:** Some of the 18 categories show as 0 or null

**Solution:**
- Check Ecoinvent proxy has been populated
- Verify migration 20251209120002 ran successfully
- Query ecoinvent_material_proxies to confirm data
- If using staging factors, only 4 categories available (expected)

### Issue 3: Wrong data source selected

**Symptom:** Expected DEFRA but got Ecoinvent (or vice versa)

**Solution:**
- Check material category_type assignment
- Review detectMaterialCategory logic
- Verify material name matches expected patterns
- Check if DEFRA mapping exists for this material

### Issue 4: Build errors

**Symptom:** TypeScript errors after updates

**Solution:**
```bash
npm run build
```

If errors persist:
- Check WaterfallResult interface matches usage
- Verify all new fields are optional (?)
- Review calculation engine AggregatedImpacts interface

---

## Next Steps After Testing

Once core functionality is verified:

1. **Create backfill migration** for existing LCAs
2. **Build data quality dashboard** to visualize provenance
3. **Add UI badges** showing data sources
4. **Enhance PDF reports** with methodology section
5. **Extend to commuting emissions** in CCF calculations
6. **Create test suite** for automated validation

---

## Support & Documentation

**Full Documentation:** See `HYBRID_DATA_MODEL_IMPLEMENTATION.md`

**Key Files:**
- `lib/impact-waterfall-resolver.ts` - Resolution logic
- `supabase/functions/calculate-product-lca-impacts/index.ts` - Aggregation
- `supabase/migrations/20251209120000_*.sql` - Database schema

**Questions or Issues:**
Refer to implementation summary document for detailed architecture, compliance framework, and technical notes.

---

**Document Version:** 1.0
**Last Updated:** 9 December 2025
**Status:** Ready for Testing ✓
