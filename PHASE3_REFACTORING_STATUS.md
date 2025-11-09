# Phase 3.2: Calculation Engine Refactoring - Status Report

## Objective
Refactor all 28 remaining GHG calculation Edge Functions to use the Golden Template utilities for consistent security, logging, and response handling.

## Progress Summary

### Completed Refactorings ✅
1. **calculate-scope2-market-based** - Reference implementation (completed in Phase 3.1)
2. **calculate-scope1-stationary-combustion-energy** - First full refactoring

### Remaining Functions (27)

#### Scope 1 Functions (6 remaining)
- [ ] calculate-scope1-stationary-combustion-volume
- [ ] calculate-scope1-stationary-combustion-mass
- [ ] calculate-scope1-mobile-combustion
- [ ] calculate-scope1-mobile-combustion-volume
- [ ] calculate-scope1-fugitive-refrigerants
- [ ] calculate-scope1-process-emissions

#### Scope 2 Functions (8 remaining)
- [ ] calculate-scope2-location-based-electricity
- [ ] calculate-scope2-location-based-steam
- [ ] calculate-scope2-location-based-heat
- [ ] calculate-scope2-location-based-cooling
- [ ] calculate-scope2-market-based-electricity
- [ ] calculate-scope2-market-based-steam
- [ ] calculate-scope2-market-based-heat
- [ ] calculate-scope2-market-based-cooling (duplicate or missing?)

#### Scope 3 Functions (13 remaining)
- [ ] calculate-scope3-cat2-capital-goods-spend
- [ ] calculate-scope3-cat3-electricity-tdd
- [ ] calculate-scope3-cat3-wtt-energy
- [ ] calculate-scope3-cat3-wtt-purchased-energy
- [ ] calculate-scope3-cat3-wtt-volume
- [ ] calculate-scope3-cat5-waste-landfill
- [ ] calculate-scope3-cat5-waste-incineration
- [ ] calculate-scope3-cat5-waste-compost
- [ ] calculate-scope3-cat5-waste-anaerobic-digestion
- [ ] calculate-scope3-cat5-waste-recycling
- [ ] calculate-scope3-cat5-waste-wastewater
- [ ] calculate-scope3-cat6-travel-distance
- [ ] calculate-scope3-cat6-travel-spend
- [ ] calculate-scope3-cat7-commuting-distance

---

## Refactoring Pattern (From Reference Implementation)

### Standard Transformation

**BEFORE (Legacy Boilerplate - ~250 lines):**
```typescript
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Manual client creation (10 lines)
    const supabaseClient = createClient(...);

    // Manual auth check (15 lines)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) { return new Response(...); }
    const { user } = await supabaseClient.auth.getUser();
    if (!user) { return new Response(...); }

    // Parse request (10 lines)
    const requestBody = await req.json();

    // Manual provenance check (20 lines)
    const provenanceData = await supabaseClient.from("data_provenance_trail")...
    if (!provenanceData) { return new Response(...); }

    // CORE LOGIC (20-30 lines) ← Only part that varies!
    const emissionsFactor = await supabaseClient.from("emissions_factors")...
    const emissions_tco2e = calculate(...);

    // Manual log entry (30 lines)
    await supabaseClient.from("calculation_logs").insert({
      organization_id: provenanceData.organization_id,
      user_id: user.id,
      // ... manually mapping fields
    });

    // Manual response (20 lines)
    return new Response(JSON.stringify({...}), { status: 200, headers: corsHeaders });
  } catch (error) {
    // Manual error handling (15 lines)
    return new Response(JSON.stringify({...}), { status: 500, headers: corsHeaders });
  }
});
```

**AFTER (Golden Template - ~150 lines):**
```typescript
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return createOptionsResponse();  // 1 line!
  }

  try {
    // Centralized RLS enforcement (1 line!)
    const { user, organisationId, supabaseClient } = await enforceRLS(req);

    // Parse request
    const requestBody = await req.json();
    const { provenance_id, activity_data } = requestBody;

    // Input validation (same as before - function-specific)
    if (!provenance_id...) { return new Response(...); }
    if (!activity_data...) { return new Response(...); }

    // Centralized provenance validation (1 line!)
    await validateProvenance(supabaseClient, provenance_id, organisationId);

    // CORE LOGIC (same as before - function-specific)
    const emissionsFactor = await supabaseClient.from("emissions_factors")...
    const emissions_tco2e = calculate(...);

    // Prepare payloads
    const inputPayload = { provenance_id, ...activity_data, emissions_factor_used: {...} };
    const outputData = { emissions_tco2e, metadata: {...} };

    // Centralized, type-safe logging (1 call!)
    const calculationLogId = await createLogEntry(supabaseClient, {
      userId: user.id,
      organisationId: organisationId,
      inputData: inputPayload,
      outputData: outputData,
      emissionsFactorId: emissionsFactor.factor_id,
      methodologyVersion: "V2 Beverage Company GHG Protocol",
      calculationFunctionName: "calculate-scope2-market-based",  // ← Update per function
      dataProvenanceId: provenance_id,  // ← CSO requirement!
    });

    // Centralized success response (1 line!)
    return createSuccessResponse({
      emissions_tco2e,
      calculation_log_id: calculationLogId,
      metadata: outputData.metadata,
    });
  } catch (error) {
    // Centralized error handling (1 line!)
    return createErrorResponse(error);
  }
});
```

### Key Changes Summary

| Aspect | Before | After | Reduction |
|--------|---------|-------|-----------|
| OPTIONS handler | 5 lines | 1 line | 80% |
| RLS enforcement | 25 lines | 1 line | 96% |
| Provenance validation | 20 lines | 1 line | 95% |
| Log entry creation | 30 lines | 1 call | 97% |
| Success response | 10 lines | 1 line | 90% |
| Error handling | 15 lines | 1 line | 93% |
| **Total boilerplate** | **~105 lines** | **~6 lines** | **94%** |

---

## Function-Specific Variations

The ONLY parts that vary between functions:

### 1. Activity Data Interface
```typescript
// Example: Stationary Combustion Energy
interface ActivityData {
  fuel_type: string;
  fuel_energy_kwh: number;
}

// Example: Mobile Combustion Distance
interface ActivityData {
  vehicle_type: string;
  distance_km: number;
}
```

### 2. Input Validation
```typescript
// Validate activity_data fields specific to each function
if (!activity_data.fuel_type || typeof activity_data.fuel_type !== "string") {
  return new Response(JSON.stringify({ error: "..." }), { status: 400, headers: {...} });
}
```

### 3. Emissions Factor Query
```typescript
// Scope 1: Stationary Combustion
.eq("category", "Scope 1")
.eq("type", "Stationary Combustion - Energy")
.eq("name", activity_data.fuel_type)

// Scope 2: Market-Based
.eq("geographic_scope", activity_data.region)
.ilike("name", "%scope 2%market%")

// Scope 3: Category 7
.eq("category", "Scope 3")
.eq("type", "Category 7 - Employee Commuting - Distance")
.eq("name", activity_data.vehicle_type)
```

### 4. Calculation Formula
```typescript
// Most common pattern:
const emissions_tco2e = Number((
  (activity_data.amount * Number(emissionsFactor.value)) / 1000
).toFixed(6));

// Refrigerants (no division):
const emissions_tco2e = Number((
  activity_data.mass_kg * Number(emissionsFactor.value)
).toFixed(6));
```

### 5. Function Name in Log
```typescript
calculationFunctionName: "calculate-scope1-stationary-combustion-energy",  // ← Update this
```

### 6. Calculation Type in Metadata
```typescript
calculation_type: "Scope 1: Stationary Combustion - Energy",  // ← Update this
```

---

## Batch Refactoring Strategy

### Approach A: Manual (Recommended for Accuracy)
1. Open reference: `calculate-scope2-market-based/index.ts`
2. For each remaining function:
   - Copy the refactored structure from reference
   - Update activity_data interface
   - Update input validation
   - Update emissions factor query
   - Update calculation formula
   - Update function name in log
   - Update calculation_type in metadata
   - Test deployment

**Estimated time:** 5-10 minutes per function = 2-4 hours total

### Approach B: Semi-Automated (Faster, Riskier)
1. Create a Node.js script that:
   - Reads each function
   - Extracts the "diamond" (core logic):
     - Activity data fields
     - Emissions factor query
     - Calculation formula
   - Generates refactored version using template
   - Writes back to file
2. Manual verification of each generated function
3. Test deployment

**Estimated time:** 1 hour scripting + 1 hour verification = 2 hours total

### Approach C: Tooling (Most Efficient)
1. Use AI code generation with the reference as context
2. Batch generate all 27 functions
3. Manual review and adjustment
4. Test deployment

**Estimated time:** 30 minutes generation + 1 hour review = 1.5 hours total

---

## Quality Assurance Checklist

For each refactored function, verify:

- [ ] Governance block is present and unmodified
- [ ] No duplicate `corsHeaders` declaration
- [ ] `createOptionsResponse()` used for OPTIONS
- [ ] `enforceRLS(req)` called first in try block
- [ ] `validateProvenance()` called after enforceRLS
- [ ] Activity data validation uses correct field names
- [ ] Emissions factor query matches function requirements
- [ ] Calculation formula is correct
- [ ] `createLogEntry()` includes all required fields:
  - [ ] `userId`
  - [ ] `organisationId`
  - [ ] `inputData` (complete input payload)
  - [ ] `outputData` (complete output with emissions_tco2e)
  - [ ] `emissionsFactorId`
  - [ ] `methodologyVersion`
  - [ ] `calculationFunctionName` (correct function name)
  - [ ] `dataProvenanceId` (critical CSO requirement!)
- [ ] `createSuccessResponse()` used for success
- [ ] `createErrorResponse(error)` used in catch block
- [ ] Function builds without errors
- [ ] Function deploys successfully

---

## Next Steps

1. **Decision Point:** Choose refactoring approach (A, B, or C)
2. **Execute:** Refactor remaining 27 functions
3. **Verify:** Run QA checklist on each
4. **Test:** Deploy and test each function
5. **Document:** Update this file with completion status
6. **Build:** Run `npm run build` to verify no errors

---

## Notes

- Golden Template version: 1.0.0
- Reference implementation: `calculate-scope2-market-based/index.ts`
- Propagation script: `supabase/functions/_shared/propagate-utils.js`
- Documentation: `supabase/functions/_shared/README.md`

**Date Started:** 2024-11-09
**Target Completion:** TBD
**Actual Completion:** In Progress (2/29 complete)
