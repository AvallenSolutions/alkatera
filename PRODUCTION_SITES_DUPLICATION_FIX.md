# Production Sites Duplication Fix

## Issue Summary

TEST CALVADOS product was showing **two allocation entries** for Test Distillery facility:
1. Jan 2025 - Nov 2025 (Verified, 3,750 kg CO2e, 1,000,000 L water, 1,000 kg waste)
2. Dec 2025 - Dec 2025 (Verified, 3,750 kg CO2e, 0 L water, 0 kg waste)

## Root Cause

The Test Distillery facility is marked as **`operational_control: third_party`** (contract manufacturer). However, its allocation was incorrectly stored in **BOTH** tables:

1. **`contract_manufacturer_allocations`** (correct) - with proper reporting periods
2. **`product_lca_production_sites`** (incorrect) - with NULL reporting periods

The frontend merged both sources, causing the duplicate to appear.

### Why "Dec 2025 - Dec 2025"?

The frontend code at `ProductionSitesTab.tsx:161-162` was using `created_at` as a fallback when `reporting_period_start/end` were NULL:

```typescript
reporting_period_start: site.created_at,  // Used timestamp as date
reporting_period_end: site.created_at,    // Used timestamp as date
```

Since the production site was created in December 2025, it showed "Dec 2025 - Dec 2025".

## Database Model

### Correct Architecture

- **`contract_manufacturer_allocations`**: For third-party/contract manufacturer facilities
- **`product_lca_production_sites`**: For owned facilities ONLY

Each allocation should exist in **ONE** table based on facility `operational_control`.

## Fixes Applied

### 1. Database Cleanup ✅

Removed duplicate entries from `product_lca_production_sites` for third-party facilities:

```sql
DELETE FROM product_lca_production_sites
WHERE facility_id IN (
  SELECT id FROM facilities WHERE operational_control = 'third_party'
);
```

**Result:** Removed 2 duplicate entries.

### 2. Database Constraint ✅

Added trigger to prevent third-party facilities from being added to `product_lca_production_sites`:

**Migration:** `add_production_sites_facility_type_trigger`

```sql
CREATE OR REPLACE FUNCTION validate_production_site_facility_type()
RETURNS TRIGGER AS $$
DECLARE
  v_operational_control TEXT;
BEGIN
  SELECT operational_control INTO v_operational_control
  FROM facilities
  WHERE id = NEW.facility_id;

  IF v_operational_control != 'owned' THEN
    RAISE EXCEPTION 'Only owned facilities can be added to production sites...';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_production_site_facility_type
  BEFORE INSERT OR UPDATE ON product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION validate_production_site_facility_type();
```

**Effect:** Database will reject attempts to add third-party facilities to production sites.

### 3. Frontend Improvements ✅

Updated `ProductionSitesTab.tsx` to:

1. **Use actual reporting periods** instead of created_at timestamps:
   ```typescript
   reporting_period_start: site.reporting_period_start || site.created_at,
   reporting_period_end: site.reporting_period_end || site.created_at,
   ```

2. **Fetch all relevant fields** from `product_lca_production_sites`:
   - `reporting_period_start`, `reporting_period_end`
   - `allocated_emissions_kg_co2e`, `allocated_water_litres`, `allocated_waste_kg`
   - `emission_intensity_kg_co2e_per_unit`, `water_intensity_litres_per_unit`, `waste_intensity_kg_per_unit`
   - `status`, `is_energy_intensive_process`, `uses_proxy_data`
   - `data_source_tag`, `co2e_entry_method`

3. **Properly map all fields** with fallbacks for backward compatibility.

## Verification

### Before Fix
```
Total Allocations: 2
├── Jan 2025 - Nov 2025 (from contract_manufacturer_allocations) ✓
└── Dec 2025 - Dec 2025 (from product_lca_production_sites) ❌ DUPLICATE
```

### After Fix
```
Total Allocations: 1
└── Jan 2025 - Nov 2025 (from contract_manufacturer_allocations) ✓
```

## Testing

```sql
-- Verify no duplicates remain
SELECT
  'CM Allocation' as source,
  id, facility_id, product_id,
  reporting_period_start, reporting_period_end,
  allocated_emissions_kg_co2e, status
FROM contract_manufacturer_allocations
WHERE product_id = 53
UNION ALL
SELECT
  'Production Site' as source,
  ps.id, ps.facility_id, pl.product_id,
  ps.reporting_period_start, ps.reporting_period_end,
  ps.allocated_emissions_kg_co2e, ps.status
FROM product_lca_production_sites ps
JOIN product_lcas pl ON ps.product_lca_id = pl.id
WHERE pl.product_id = 53;
```

**Expected:** Only 1 row from `contract_manufacturer_allocations`.

## Files Modified

1. **Database Migration:**
   - `supabase/migrations/add_production_sites_facility_type_trigger.sql`

2. **Frontend:**
   - `components/products/ProductionSitesTab.tsx`

## Build Status

✅ Build completed successfully with no errors.

---

**Status:** ✅ Fixed and verified
**Date:** 18 December 2024
