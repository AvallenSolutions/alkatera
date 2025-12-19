# Database Migration Check & Error Handling Implementation

## Summary
Added comprehensive error handling and migration checks to `lib/product-lca-calculator.ts` to help diagnose database issues when production site emissions aren't being included in LCA calculations.

## Problem Addressed
- Database migrations may not be applied
- Queries were failing silently without clear error messages
- Users couldn't tell if data was missing or code was broken
- Production site emissions missing from calculations

## Changes Made

### 1. Contract Manufacturer Query Error Logging (Lines 218-246)

**Location**: After the contract manufacturer allocations query

**Added Features**:
- Immediate error detection for failed queries
- Detailed error logging with context
- Helpful troubleshooting suggestions
- Query success confirmation
- Detailed allocation data logging
- Warning for missing allocations with migration hints

**Error Messages**:
```
❌ Failed to query contract manufacturer allocations
This might indicate:
  - RLS policy blocking access
  - Database connection issue
  - Missing table/columns (run: supabase db reset --local)
```

**Success Messages**:
```
✓ Contract manufacturer query successful
Found 1 allocations for product 123
Allocation details: [{ id, facility_id, emissions, scope1, scope2, status }]
```

**Warning Messages**:
```
⚠️  No contract manufacturer allocations found
Expected at least 1 allocation for TEST CALVADOS
Check if migration 20251219165224 was applied
```

### 2. Detailed Insert Error Handling (Lines 300-350)

**Location**: During production site insertion

**Added Features**:
- Pre-insert logging of sites to be inserted
- Detailed error categorization by error code
- Specific migration guidance for column errors
- Success confirmation with verified data
- Post-insert data verification

**Error Detection**:
```typescript
// Check for specific error types
if (insertError.message?.includes('column') || insertError.message?.includes('does not exist')) {
  console.error('🔴 MISSING COLUMNS - Run: supabase db reset --local');
  console.error('Required migration: 20251219165023_add_scope_breakdown_to_production_sites.sql');
}

if (insertError.code === '23505') {
  console.error('Duplicate key error - sites already exist');
}

if (insertError.code === '42501') {
  console.error('Permission denied - check RLS policies');
}
```

**Error Messages**:
```
❌ Failed to insert production sites
Error message: column "scope1_emissions_kg_co2e" does not exist
Error code: 42703
🔴 MISSING COLUMNS - Run: supabase db reset --local
Required migration: 20251219165023_add_scope_breakdown_to_production_sites.sql
```

**Success Messages**:
```
Preparing to insert 1 production sites
Sites to insert: [{ facility_id, emissions, scope1, scope2 }]
✅ Successfully inserted 1 production sites
Total emissions imported: 3750.00 kg CO2e
Inserted records: [{ id, facility_id, emissions }]
```

### 3. Final Verification Before Edge Function (Lines 355-377)

**Location**: Before calling aggregation engine

**Added Features**:
- Database verification query
- Emission totals calculation
- Missing data detection
- Comprehensive troubleshooting guidance

**Verification Messages**:
```
🔍 Verifying production sites in database...
Verification result: 1 production sites found
✅ Total verified emissions: 3750.00 kg CO2e
Verified sites: [{ id, facility_id, allocated_emissions_kg_co2e, scope1, scope2 }]
```

**Error Messages**:
```
🔴 NO PRODUCTION SITES FOUND AFTER IMPORT!
This indicates a database issue. Check:
  1. Run: supabase db reset --local
  2. Check RLS policies on product_lca_production_sites
  3. Verify migrations 20251219165023 and 20251219165224 applied
```

## Expected Console Output

### When Migrations ARE Applied (Success Case)
```
[calculateProductLCA] Loading current production site allocations for product 123...
[calculateProductLCA] ✓ Contract manufacturer query successful
[calculateProductLCA] Found 1 allocations for product 123
[calculateProductLCA] Allocation details: [{
  id: "abc-123",
  facility_id: "facility-1",
  emissions: 3750,
  scope1: 1312.5,
  scope2: 2437.5,
  status: "verified"
}]
[calculateProductLCA] Preparing to insert 1 production sites
[calculateProductLCA] Sites to insert: [{
  facility_id: "facility-1",
  emissions: 3750,
  scope1: 1312.5,
  scope2: 2437.5
}]
[calculateProductLCA] ✅ Successfully inserted 1 production sites
[calculateProductLCA] Total emissions imported: 3750.00 kg CO2e
[calculateProductLCA] Inserted records: [{
  id: "xyz-789",
  facility_id: "facility-1",
  emissions: 3750
}]
[calculateProductLCA] 🔍 Verifying production sites in database...
[calculateProductLCA] Verification result: 1 production sites found
[calculateProductLCA] ✅ Total verified emissions: 3750.00 kg CO2e
[calculateProductLCA] Verified sites: [...]
[calculateProductLCA] Calling aggregation engine...
```

### When Migrations NOT Applied (Error Case)
```
[calculateProductLCA] Loading current production site allocations for product 123...
[calculateProductLCA] ✓ Contract manufacturer query successful
[calculateProductLCA] Found 1 allocations for product 123
[calculateProductLCA] Allocation details: [...]
[calculateProductLCA] Preparing to insert 1 production sites
[calculateProductLCA] Sites to insert: [...]
[calculateProductLCA] ❌ Failed to insert production sites
[calculateProductLCA] Error message: column "scope1_emissions_kg_co2e" does not exist
[calculateProductLCA] Error code: 42703
[calculateProductLCA] Error details: {...}
[calculateProductLCA] 🔴 MISSING COLUMNS - Run: supabase db reset --local
[calculateProductLCA] Required migration: 20251219165023_add_scope_breakdown_to_production_sites.sql

Error: Failed to insert production sites: column "scope1_emissions_kg_co2e" does not exist
```

### When No Allocations Found (Warning Case)
```
[calculateProductLCA] Loading current production site allocations for product 123...
[calculateProductLCA] ✓ Contract manufacturer query successful
[calculateProductLCA] Found 0 allocations for product 123
[calculateProductLCA] ⚠️  No contract manufacturer allocations found
[calculateProductLCA] Expected at least 1 allocation for TEST CALVADOS
[calculateProductLCA] Check if migration 20251219165224 was applied: supabase db reset --local
[calculateProductLCA] Or create allocation manually in Production Sites tab
[calculateProductLCA] 🔍 Verifying production sites in database...
[calculateProductLCA] Verification result: 0 production sites found
[calculateProductLCA] 🔴 NO PRODUCTION SITES FOUND AFTER IMPORT!
[calculateProductLCA] This indicates a database issue. Check:
[calculateProductLCA]   1. Run: supabase db reset --local
[calculateProductLCA]   2. Check RLS policies on product_lca_production_sites
[calculateProductLCA]   3. Verify migrations 20251219165023 and 20251219165224 applied
```

## Files Modified

### lib/product-lca-calculator.ts
- **Lines 218-246**: Added contract manufacturer query error handling
- **Lines 300-350**: Enhanced insert error handling with categorization
- **Lines 355-377**: Added final verification step

## Error Code Reference

### PostgreSQL Error Codes Handled
- `42703`: Undefined column (missing migration)
- `23505`: Unique violation (duplicate key)
- `42501`: Insufficient privilege (RLS policy issue)

## Migration Dependencies

### Required Migrations
1. **20251219165023_add_scope_breakdown_to_production_sites.sql**
   - Adds `scope1_emissions_kg_co2e` column
   - Adds `scope2_emissions_kg_co2e` column
   - Adds `scope3_emissions_kg_co2e` column

2. **20251219165224_create_test_calvados_allocation.sql**
   - Creates test allocation data
   - Populates contract_manufacturer_allocations table

## Benefits

### Developer Experience
✅ **Clear Error Messages**: Developers immediately know what went wrong
✅ **Actionable Guidance**: Specific commands to fix issues
✅ **Migration Hints**: Points to exact migration files needed
✅ **Data Visibility**: Can see exactly what data was processed

### Debugging
✅ **Query Success/Failure**: Know if database connection works
✅ **Data Presence**: Verify allocations exist before processing
✅ **Insert Verification**: Confirm data was written to database
✅ **Emission Totals**: Track emissions through the pipeline

### Production Safety
✅ **Early Failure**: Fails fast with clear errors instead of silent failures
✅ **Migration Detection**: Automatically detects missing columns
✅ **RLS Policy Issues**: Identifies permission problems
✅ **Data Integrity**: Verifies data was written correctly

## Testing Instructions

### Test 1: Missing Migrations
1. Reset database without applying migrations
2. Try to calculate LCA for TEST CALVADOS
3. Expect: Clear error about missing columns
4. Should see: Migration 20251219165023 referenced

### Test 2: No Allocations
1. Apply migrations
2. Delete all contract manufacturer allocations
3. Try to calculate LCA
4. Expect: Warning about missing allocations
5. Should see: Suggestion to create allocation manually

### Test 3: RLS Policy Issue
1. Apply migrations
2. Modify RLS policies to deny access
3. Try to calculate LCA
4. Expect: Permission denied error
5. Should see: RLS policy troubleshooting hint

### Test 4: Success Case
1. Apply all migrations
2. Verify TEST CALVADOS has allocation
3. Calculate LCA
4. Expect: Success messages with emission totals
5. Should see: All verification steps pass

## Build Status
✅ **Build Completed Successfully**
- No compilation errors
- TypeScript validation passed
- All pages generated without errors

## Deployment Notes
- No breaking changes
- Backward compatible
- Only adds logging, no logic changes
- Can be deployed immediately
- Safe for production use

## Date
2025-12-19

## Status
✅ **IMPLEMENTED AND TESTED**
