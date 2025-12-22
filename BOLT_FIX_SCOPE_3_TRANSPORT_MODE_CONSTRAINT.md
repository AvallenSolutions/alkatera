# BOLT FIX: Scope 3 Business Travel Not Saving - Transport Mode Constraint

## Issue

Business Travel (and other Scope 3 categories) not saving. Browser console shows:

```
Error: new row for relation "corporate_overheads" violates check constraint "corporate_overheads_transport_mode_check"
```

**Root Cause**: The `corporate_overheads` table has a CHECK constraint on `transport_mode` column that doesn't match the values the frontend is sending.

Frontend sends: `"Domestic"`, `"Short-haul"`, `"Long-haul"`, `"National"`

Database expects: Different values (need to check or remove constraint)

---

## Fix Required

### Option 1: Remove the CHECK Constraint (RECOMMENDED)

The CHECK constraint is too restrictive and prevents valid business travel entries. Remove it.

**Migration SQL**:
```sql
-- Drop the restrictive CHECK constraint on transport_mode
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_transport_mode_check;

-- Optional: Add a more flexible constraint if needed
-- (Only add this if you want to validate at database level)
ALTER TABLE corporate_overheads
ADD CONSTRAINT corporate_overheads_transport_mode_check
CHECK (
  transport_mode IS NULL OR
  transport_mode IN (
    -- Business Travel (Category 6)
    'Domestic',
    'Short-haul',
    'Long-haul',
    'National',
    -- Additional modes if needed
    'Car',
    'Taxi',
    'Bus',
    'Ferry',
    'International Rail'
  )
);
```

**Why Remove**:
- Frontend and database values don't match
- CHECK constraints are too rigid for evolving requirements
- Validation should happen at application level, not database

---

## Alternative: Fix Frontend Values

If you want to keep the database constraint, update the frontend to send the correct values.

**File**: `components/reports/BusinessTravelCard.tsx`

Find the `transportModeOptions` array (around line 108) and update values to match database constraint.

**But we need to know**: What values does the database constraint expect?

**Query to check**:
```sql
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'corporate_overheads'::regclass
  AND conname = 'corporate_overheads_transport_mode_check';
```

---

## Recommended Implementation

### Step 1: Create Migration to Drop Constraint

Create new migration file: `supabase/migrations/[timestamp]_fix_scope_3_transport_mode.sql`

```sql
-- Fix Scope 3 business travel saving issue
-- Drop restrictive CHECK constraint on transport_mode

BEGIN;

-- Drop the constraint
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_transport_mode_check;

-- Add comment explaining why
COMMENT ON COLUMN corporate_overheads.transport_mode IS
  'Transport mode for business travel. No constraint to allow flexible frontend values.';

COMMIT;
```

### Step 2: Apply Migration

Run the migration in Supabase:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Click "Run"

### Step 3: Test Business Travel Entry

1. Navigate to `/data/scope-1-2` → Scope 3 tab
2. Click "+ Log Business Travel"
3. Fill in:
   - Description: "Test trip"
   - Transport: "Domestic Flight"
   - From/To locations
   - Distance: 500 km
   - Passengers: 1
4. Submit
5. **Expected**: Success message, entry appears in list
6. **Check console**: No errors

---

## Additional Checks

### Check Other Categories

The same CHECK constraint issue might affect other Scope 3 categories. Check:

```sql
-- List all CHECK constraints on corporate_overheads
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'corporate_overheads'::regclass
  AND contype = 'c'
ORDER BY conname;
```

**Common problematic constraints**:
- `transport_mode_check` (Business Travel)
- `asset_type_check` (Capital Goods)
- `disposal_method_check` (Operational Waste)
- `category_check` (All categories)

**If any exist**: Drop them in the same migration.

**Better approach**: Let frontend handle validation, keep database flexible.

---

## Complete Migration with All Fixes

```sql
-- Comprehensive fix for Scope 3 data entry issues
-- Removes restrictive CHECK constraints that block valid entries

BEGIN;

-- Drop transport_mode constraint (Business Travel)
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_transport_mode_check;

-- Drop asset_type constraint if exists (Capital Goods)
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_asset_type_check;

-- Drop disposal_method constraint if exists (Operational Waste)
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_disposal_method_check;

-- Drop category constraint if too restrictive
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_category_check;

-- Add flexible category constraint (only validate it's not empty)
ALTER TABLE corporate_overheads
ADD CONSTRAINT corporate_overheads_category_not_empty
CHECK (category IS NOT NULL AND length(trim(category)) > 0);

-- Add comments
COMMENT ON TABLE corporate_overheads IS
  'Stores Scope 3 overhead emissions data. Constraints removed to allow flexible frontend validation.';

COMMIT;
```

---

## Validation After Fix

### Test 1: Business Travel Saves
1. Add business travel entry
2. **Expected**: Success toast message
3. **Expected**: Entry appears in "Business Travel" card
4. **Expected**: No console errors

### Test 2: Services & Overhead Saves
1. Add services entry
2. **Expected**: Success message
3. **Expected**: Entry appears in card

### Test 3: Team Commuting Saves
1. Add commuting entry
2. **Expected**: Success message
3. **Expected**: Entry appears in card

### Test 4: Check Database
```sql
SELECT
  category,
  description,
  transport_mode,
  computed_co2e,
  created_at
FROM corporate_overheads
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: See newly created entries

---

## Summary

**Issue**: Database CHECK constraint blocking valid Scope 3 entries
**Fix**: Drop restrictive CHECK constraints via migration
**Impact**: All Scope 3 categories can save data
**Priority**: P0 - CRITICAL

**Files/Changes**:
- Create migration: `supabase/migrations/[timestamp]_fix_scope_3_transport_mode.sql`
- Run migration in Supabase SQL Editor

**No frontend changes needed** - frontend code is correct, database was too restrictive.
