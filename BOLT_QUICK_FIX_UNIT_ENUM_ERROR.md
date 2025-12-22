# BOLT QUICK FIX: Unit Enum Validation Error

## Issue
When saving Scope 1 or 2 data, getting error:
```
Invalid enum value. Expected 'kWh' | 'MWh', received ''
```

Data saves correctly but validation error appears.

## Root Cause

**File**: `app/(authenticated)/data/scope-1-2/page.tsx`

**Lines 60-83**: Form schemas have restrictive enum validation:

```typescript
// Scope 1 schema - Line 67
unit: z.enum(['litres', 'kWh', 'cubic meters', 'kg', 'tonnes'], {
  required_error: 'Unit is required',
}),

// Scope 2 schema - Line 79
unit: z.enum(['kWh', 'MWh'], {
  required_error: 'Unit is required',
}),
```

**Problem**:
- Scope 2 sources may have units like "kWh", "MWh", or other units from `scope_1_2_emission_sources.default_unit`
- When form initializes or resets, unit might be empty string `''`
- Auto-selection happens AFTER validation runs

## Fix

Replace the restrictive enums with flexible string validation that accepts any non-empty string.

### Replace Lines 60-71 (Scope 1 Schema)

**FROM**:
```typescript
const scope1Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.enum(['litres', 'kWh', 'cubic meters', 'kg', 'tonnes'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
});
```

**TO**:
```typescript
const scope1Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.string().min(1, 'Unit is required'),
  activity_date: z.string().min(1, 'Activity date is required'),
});
```

### Replace Lines 73-83 (Scope 2 Schema)

**FROM**:
```typescript
const scope2Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  amount: z.string().min(1, 'Electricity consumed is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.enum(['kWh', 'MWh'], {
    required_error: 'Unit is required',
  }),
  activity_date: z.string().min(1, 'Activity date is required'),
});
```

**TO**:
```typescript
const scope2Schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  source_type: z.string().min(1, 'Source type is required'),
  amount: z.string().min(1, 'Electricity consumed is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  unit: z.string().min(1, 'Unit is required'),
  activity_date: z.string().min(1, 'Activity date is required'),
});
```

**Note**: Also added `source_type` field to Scope 2 schema (should have been in the original fix).

## Why This Fix Works

1. **Flexible Validation**: Accepts any unit string from `scope_1_2_emission_sources.default_unit`
2. **No Empty Strings**: Still validates that unit is not empty
3. **Database-Driven**: Units come from database, not hardcoded in frontend
4. **Future-Proof**: Adding new emission sources with different units won't break validation

## Alternative (If You Want Strict Validation)

If you want to keep strict enum validation, you need to ensure the unit field is OPTIONAL during form initialization and only required on submit:

```typescript
unit: z.string().min(1, 'Unit is required').optional().or(z.literal('')),
```

But the recommended approach is to use flexible string validation since units are database-driven.

## Testing

After fix:
1. Select Scope 1 fuel type → Unit auto-selects → No error
2. Submit form → Data saves → Success message only (no enum error)
3. Select Scope 2 source → Unit auto-selects → No error
4. Submit form → Data saves → Success message only

---

**Priority**: P1 - User Experience Issue
**Effort**: 2 minutes
**Impact**: Removes confusing error message
