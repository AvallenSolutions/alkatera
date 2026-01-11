# Water Calculation Fix - Process Water Double Counting

## Problem Identified

The Product LCA embedded water calculation was incorrectly including "Process Water" entries from `product_lca_materials`, causing double counting with operational facility water.

### Example: Test Calvados
- **Product footprint per unit**: 149.75 m³ (INCORRECT - included process water)
  - Embedded water (ingredients, packaging): 105.75 m³ ✓
  - Process water: 44 m³ (22 entries × 2 m³ each) ❌
- **Production volume**: 100,000 units
- **Total embedded water (incorrect)**: 14,974,522 m³

## Root Cause

Process water represents operational water usage at the production facility and should be:
1. Tracked in `facility_activity_entries` (water_intake)
2. **NOT** included in product LCA materials
3. **NOT** counted as embedded supply chain water

When included in both places, it gets counted twice:
- Once as facility operational water
- Once as product embedded water (14.97M m³ for Test Calvados alone!)

## Solution Implemented

Updated `company_water_overview` view to exclude process water from embedded water calculation:

```sql
WHERE plm.name NOT ILIKE '%process water%'
```

## Corrected Calculation

### Test Calvados (Corrected)
- **Embedded water per unit**: 105.75 m³ (apples, packaging, transport only)
- **Process water per unit**: 44 m³ (EXCLUDED from embedded calculation)
- **Production volume**: 100,000 units
- **Total embedded water (correct)**: 10,574,522 m³ (105.75 × 100,000)

### Water Breakdown Structure

```
Total Water Footprint = Operational Water + Embedded Water

Where:
- Operational Water = Direct facility usage from facility_activity_entries
  - Water intake (900 m³ for test distillery)
  - Water discharge
  - Net consumption

- Embedded Water = Supply chain footprint from product materials
  - Ingredients (e.g., apples: 8 kg × 0.6 m³/kg = 4.8 m³)
  - Packaging (glass, caps, labels)
  - Transport emissions
  - EXCLUDES: Process Water (to avoid double counting)
```

## Migration Applied

**File**: `20260111000000_fix_embedded_water_calculation_exclude_process_water.sql`

**Changes**:
1. Recreated `company_water_overview` view with two CTEs:
   - `operational_water`: From facility_water_summary
   - `embedded_water`: From product_lca_materials (excluding process water)

2. Added explicit columns for clarity:
   - `operational_net_m3`: Direct facility water usage
   - `embedded_water_m3`: Supply chain water footprint (no process water)
   - `total_water_footprint_m3`: Sum of operational + embedded (no double counting)

## Verification

```sql
-- Test Calvados water breakdown
SELECT
  -- Embedded (correct): 105.75 m³/unit
  SUM(CASE WHEN name NOT ILIKE '%process water%' THEN impact_water ELSE 0 END) as embedded_water_per_unit,

  -- Process water (excluded): 44 m³/unit
  SUM(CASE WHEN name ILIKE '%process water%' THEN impact_water ELSE 0 END) as process_water_per_unit
FROM product_lca_materials;
```

## Next Steps

1. **Remove Process Water entries** from product_lca_materials entirely (they shouldn't be there)
2. **Update LCA calculation logic** to never add process water as a material
3. **Document best practice**: Process water = facility operational data only

## Impact

- Test Calvados embedded water: Reduced from 14.97M m³ to 10.57M m³ (correct)
- Company vitality dashboard now shows accurate water footprint
- No double counting between operational and embedded water streams
