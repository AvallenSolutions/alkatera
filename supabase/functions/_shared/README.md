# Calculation Utilities - Golden Template Pattern

## Overview

This directory contains the **Golden Template** for all GHG calculation Edge Functions. The pattern addresses "compliance debt" by centralising security (RLS) and structured logging logic into a single, versioned, and auditable utility library.

## Strategic Imperative

As mandated by the CSO and approved by leadership, centralising our calculation boilerplate is a **mandatory governance control**. This ensures:

1. **Glass Box Auditability** - Every calculation is logged consistently
2. **RLS Enforcement** - User authentication and organisation context is validated uniformly
3. **Immutable Audit Trail** - All calculations link to data provenance
4. **Compliance-Ready** - Supports ISO 14064, GHG Protocol, and regulatory requirements

## Architecture Pattern

### The Golden Template

The `calculation-utils.ts` file contains all shared utilities that must be present in every calculation function:

```
calculation-utils.ts
├── Types & Interfaces
│   ├── LogPayload (with dataProvenanceId)
│   └── EnforceRLSResult
├── Security Functions
│   ├── getSupabaseClient()
│   ├── enforceRLS()
│   └── validateProvenance()
└── Logging & Response Functions
    ├── createLogEntry()
    ├── createErrorResponse()
    ├── createSuccessResponse()
    └── createOptionsResponse()
```

### Governance Markers

Each calculation function contains the governance block between these markers:

```typescript
// === GOVERNANCE: CALCULATION UTILITIES START ===
// ... Golden Template code injected here ...
// === GOVERNANCE: CALCULATION UTILITIES END ===
```

**CRITICAL:** Never manually edit code between these markers. Use the propagation script instead.

## Files in This Directory

### 1. calculation-utils.ts (Golden Template)

The source of truth for all shared utilities. This file is **never deployed** directly - it's propagated to individual functions.

**Key Exports:**

- `LogPayload` - Interface with mandatory `dataProvenanceId` field (CSO requirement)
- `enforceRLS()` - Validates JWT, retrieves user, checks organisation membership
- `createLogEntry()` - Writes structured log to `calculation_logs` table
- `validateProvenance()` - Verifies provenance_id belongs to organisation
- Response helpers - Standardised HTTP responses with CORS

### 2. propagate-utils.js (Node.js)

Automated script to inject the Golden Template into all calculation functions.

**Usage:**

```bash
node supabase/functions/_shared/propagate-utils.js
```

**What it does:**

1. Reads `calculation-utils.ts`
2. Discovers all `calculate-*` Edge Functions
3. Injects/updates governance block in each function
4. Maintains function-specific code outside governance markers

**When to run:**

- After updating `calculation-utils.ts`
- After adding a new calculation function
- Before deploying any calculation functions
- As part of CI/CD pipeline (recommended)

### 3. propagate-utils.ts (Deno)

Deno version of the propagation script (for future use when Deno is available in the build environment).

## Using the Pattern in a Calculation Function

### Before Refactoring (Old Pattern)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // 1. Manual Supabase client creation
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 2. Manual RLS check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
  }

  const { user } = await supabaseClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // ... core calculation logic ...

  // 3. Manual log entry creation
  await supabaseClient.from('calculation_logs').insert({
    organization_id: orgId,
    user_id: user.id,
    // ... manually mapping fields
  });

  return new Response(JSON.stringify({ result }), { status: 200 });
});
```

**Problems:**

- ❌ Boilerplate repeated in 29+ functions
- ❌ Inconsistent error handling
- ❌ Missing dataProvenanceId in logs (compliance gap)
- ❌ No organisation validation
- ❌ Difficult to audit and maintain

### After Refactoring (Golden Pattern)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// === GOVERNANCE: CALCULATION UTILITIES START ===
// ... Golden Template injected by propagation script ...
// === GOVERNANCE: CALCULATION UTILITIES END ===

interface ActivityData {
  // Function-specific activity data
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return createOptionsResponse();
  }

  try {
    // 1. Centralised RLS check (one line!)
    const { user, organisationId, supabaseClient } = await enforceRLS(req);

    // 2. Parse and validate input
    const requestBody = await req.json();
    const { provenance_id, activity_data } = requestBody;

    // Validate inputs...

    // 3. Validate provenance (one line!)
    await validateProvenance(supabaseClient, provenance_id, organisationId);

    // 4. Core calculation logic (function-specific)
    const emissionsFactor = await supabaseClient
      .from("emissions_factors")
      .select("*")
      // ... query emissions factors ...

    const emissions_tco2e = calculateEmissions(activity_data, emissionsFactor);

    // 5. Centralised, type-safe logging (with dataProvenanceId!)
    const calculationLogId = await createLogEntry(supabaseClient, {
      userId: user.id,
      organisationId: organisationId,
      inputData: { provenance_id, ...activity_data },
      outputData: { emissions_tco2e, metadata: {...} },
      emissionsFactorId: emissionsFactor.factor_id,
      methodologyVersion: "V2 Beverage Company GHG Protocol",
      calculationFunctionName: "calculate-scope2-market-based",
      dataProvenanceId: provenance_id, // CSO requirement ✅
    });

    // 6. Standardised response
    return createSuccessResponse({
      emissions_tco2e,
      calculation_log_id: calculationLogId,
      metadata: {...}
    });
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

**Benefits:**

- ✅ Consistent RLS enforcement across all functions
- ✅ Complete audit trail with dataProvenanceId
- ✅ Type-safe logging interface
- ✅ Standardised error handling
- ✅ CORS handled automatically
- ✅ Single source of truth for governance logic
- ✅ Compliance-ready (ISO 14064, GHG Protocol)

## LogPayload Interface

The `LogPayload` interface is the **data contract** for all calculation logs:

```typescript
export interface LogPayload {
  userId: string;                    // User who triggered calculation
  organisationId: string;            // Organisation context (RLS boundary)
  inputData: Record<string, any>;   // Complete input JSON
  outputData: Record<string, any>;  // Complete output JSON
  emissionsFactorId: string;         // Emissions factor UUID used
  methodologyVersion: string;        // e.g., "V2 Beverage Company GHG Protocol"
  calculationFunctionName: string;   // e.g., "calculate-scope2-market-based"
  dataProvenanceId: string;          // CRITICAL: Links to evidence record (CSO mandate)
}
```

### Why dataProvenanceId is Mandatory

Per CSO directive, every calculation must link to its evidence source:

```
Evidence → Provenance → Calculation → Log
   ↓           ↓            ↓           ↓
Invoice  → provenance_id → API call → audit trail
```

This creates an **immutable chain of custody** from raw data to reported emissions.

## Workflow: Updating the Golden Template

### Scenario: Adding a new utility function

1. **Update the Golden Template:**

```bash
# Edit the source file
vim supabase/functions/_shared/calculation-utils.ts

# Add your new function within the governance block
export async function newUtilityFunction() {
  // implementation
}
```

2. **Propagate to all functions:**

```bash
node supabase/functions/_shared/propagate-utils.js
```

Output:
```
🚀 Starting Golden Template Propagation...
📖 Reading Golden Template...
✅ Loaded 5825 characters

🔍 Discovering calculation functions...
✅ Found 29 calculation functions

⚙️  Propagating utilities to functions...
   ✅ UPDATED: calculate-scope1-fugitive-refrigerants
   ✅ UPDATED: calculate-scope2-market-based
   ... (27 more)

📊 PROPAGATION SUMMARY
Total functions processed: 29
✅ Updated: 29
⚠️  Skipped: 0
❌ Errors: 0

✨ Propagation complete!
```

3. **Verify one function manually:**

```bash
cat supabase/functions/calculate-scope2-market-based/index.ts | grep "newUtilityFunction"
```

4. **Deploy functions:**

```bash
# Deploy using mcp__supabase__deploy_edge_function tool
# Or using Supabase CLI (if available)
```

## Best Practices

### DO ✅

- Run propagation script before deploying
- Keep function-specific logic outside governance markers
- Use the utility functions consistently
- Include `dataProvenanceId` in all logs
- Test after propagation

### DON'T ❌

- Manually edit code between governance markers
- Skip running propagation after template updates
- Omit `dataProvenanceId` from log entries
- Copy-paste boilerplate between functions
- Deploy without propagating latest template

## Troubleshooting

### "Duplicate import" error

**Cause:** Function has imports both outside and inside governance block.

**Fix:** Remove imports outside the governance markers that duplicate those inside:

```typescript
// ❌ WRONG - duplicate import
import { createClient } from "npm:@supabase/supabase-js@2";

// === GOVERNANCE: CALCULATION UTILITIES START ===
import { createClient } from "npm:@supabase/supabase-js@2";
// ...
```

```typescript
// ✅ CORRECT - import only in governance block
// === GOVERNANCE: CALCULATION UTILITIES START ===
import { createClient } from "npm:@supabase/supabase-js@2";
// ...
```

### Propagation script fails on a function

Check the function has at least one blank line after imports for marker injection:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ← This blank line is required
interface ActivityData {
```

### Function not using utility functions

This is expected after initial propagation. You must manually refactor the function logic to use `enforceRLS()`, `createLogEntry()`, etc. See the "After Refactoring" example above.

## Compliance & Audit Trail

### Data Provenance Chain

```
┌─────────────────────────────────────────────────────────────┐
│                   COMPLIANCE CHAIN                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Evidence Upload (Invoice, Meter Reading)               │
│     ↓                                                       │
│     Creates: data_provenance_trail record                   │
│     • provenance_id (UUID)                                  │
│     • organization_id                                       │
│     • uploaded_by (user_id)                                 │
│     • file_url (encrypted S3 path)                          │
│     • metadata (checksums, timestamps)                      │
│                                                             │
│  2. Calculation Request                                     │
│     ↓                                                       │
│     POST /calculate-scope2-market-based                     │
│     • provenance_id (references evidence)                   │
│     • activity_data (kwh, region, etc.)                     │
│                                                             │
│  3. RLS Enforcement (enforceRLS)                            │
│     ↓                                                       │
│     Validates:                                              │
│     • JWT token valid                                       │
│     • User belongs to organization                          │
│     • Organization matches provenance record                │
│                                                             │
│  4. Calculation Execution                                   │
│     ↓                                                       │
│     • Query emissions_factors table                         │
│     • Perform calculation                                   │
│     • Generate output_value (tCO2e)                         │
│                                                             │
│  5. Immutable Log Entry (createLogEntry)                    │
│     ↓                                                       │
│     Inserts into calculation_logs:                          │
│     • log_id (UUID, primary key)                            │
│     • organization_id (RLS boundary)                        │
│     • user_id (who calculated)                              │
│     • input_data (complete input JSON)                      │
│     • output_value (emissions result)                       │
│     • emissions_factor_id (which EF used)                   │
│     • methodology_version (GHG Protocol version)            │
│     • dataProvenanceId ★ (links to evidence)               │
│     • created_at (immutable timestamp)                      │
│                                                             │
│  6. Audit Query (years later)                               │
│     ↓                                                       │
│     SELECT * FROM calculation_logs WHERE log_id = '...'     │
│     ↓                                                       │
│     Reveals complete audit trail:                           │
│     • What data was used (via dataProvenanceId)            │
│     • Which emissions factor was applied                    │
│     • Who performed the calculation                         │
│     • When it was performed                                 │
│     • Full input and output                                 │
│     • Methodology version (for replication)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### ISO 14064 & GHG Protocol Compliance

The Golden Template pattern satisfies:

**ISO 14064-3 Requirements:**
- ✅ Data quality (provenance linkage)
- ✅ Completeness (full input/output capture)
- ✅ Consistency (standardised methodology)
- ✅ Accuracy (emissions factor traceability)
- ✅ Transparency (glass box logging)

**GHG Protocol Requirements:**
- ✅ Boundary definition (organisation_id via RLS)
- ✅ Calculation methodology (methodology_version)
- ✅ Data sources (dataProvenanceId)
- ✅ Emissions factors (factor_ids_used)
- ✅ Recalculation (input_data enables replication)

## Version History

- **v1.0.0** (2024-11-09): Initial Golden Template with dataProvenanceId
  - Added LogPayload interface with CSO-mandated provenance field
  - Created propagation scripts (Node.js + Deno)
  - Refactored calculate-scope2-market-based as reference implementation
  - Propagated to 29 calculation functions

## Future Enhancements

1. **CI/CD Integration**: Auto-run propagation script on template changes
2. **Version Control**: Add template version to governance markers
3. **Rollback Support**: Maintain template version history
4. **Test Suite**: Automated testing of utility functions
5. **Documentation**: Auto-generate function docs from LogPayload

## Contact

For questions about the Golden Template pattern or compliance requirements:

- **Technical Lead**: [Your Name]
- **CSO (Compliance)**: [CSO Name]
- **Governance**: Refer to internal compliance documentation

---

**Last Updated**: 2024-11-09
**Template Version**: 1.0.0
**Functions Covered**: 29/29 ✅
