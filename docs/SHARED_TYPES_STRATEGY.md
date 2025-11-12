# Strategy Decision: Shared Type Definitions for API Contracts

## Problem Statement

When developing full-stack applications with separate frontend (Next.js) and backend (Edge Functions) codebases, maintaining consistency between API contracts is challenging. Common issues include:

- **Type Mismatches:** Frontend expects different shape than backend provides
- **Integration Errors:** Runtime failures due to contract violations
- **Documentation Drift:** Comments become outdated, types diverge
- **Development Friction:** Engineers must manually sync types across boundaries
- **Refactoring Risk:** Changing one side breaks the other silently

## Decision

**We will establish a shared TypeScript types package within our monorepo to define all API contracts in a single location.**

## Implementation

### Current Implementation

**Location:** `lib/types/lca.ts`

This file contains:
- Request/response interfaces for all Edge Functions
- Domain types (OpenLcaProcess, ActivityDataPoint, etc.)
- Enumerations (SourceType, DQITier)
- Error response types
- Helper type mappings

### Usage Pattern

**Frontend (React Components):**
```typescript
import {
  OpenLcaProcess,
  CreateActivityDataPointRequest
} from '@/lib/types/lca';

// Type-safe API call
const request: CreateActivityDataPointRequest = {
  sourceType: 'platform_estimate', // IntelliSense autocomplete
  dataPayload: { /* ... */ },
  // TypeScript enforces all required fields
};
```

**Backend (Edge Functions):**
```typescript
// Copy shared types to Edge Function or reference from shared location
interface CreateActivityDataPointRequest {
  sourceType: SourceType;
  dataPayload: { /* ... */ };
  // Exact same shape as frontend
}
```

**Note:** Edge Functions currently have types duplicated. Future improvement: configure Deno to import from shared `lib/types/` directory.

## Benefits

### 1. Compile-Time Safety

TypeScript catches contract violations before deployment:
- Missing required fields
- Incorrect data types
- Misspelled property names
- Wrong enum values

### 2. Self-Documenting APIs

Types serve as living documentation:
- IntelliSense shows available fields
- JSDoc comments explain purpose
- Type definitions reveal structure

### 3. Refactoring Confidence

Change types once, errors surface everywhere:
- Rename fields: all usages flagged
- Add required field: compiler enforces updates
- Change data type: incompatible code identified

### 4. Development Velocity

Engineers move faster:
- No manual contract coordination
- Autocomplete accelerates coding
- Fewer integration bugs
- Less debugging time

### 5. Onboarding Speed

New engineers understand APIs quickly:
- Browse type definitions
- See expected shapes
- Understand relationships
- Copy-paste working examples

## Best Practices

### 1. Define Types Before Implementation

Write interfaces first:
1. Design API contract
2. Define request/response types
3. Implement frontend
4. Implement backend

Both sides work against agreed contract.

### 2. Use Strict TypeScript Settings

Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 3. Document with JSDoc

Add comments explaining non-obvious fields:
```typescript
/**
 * Source type classification for activity data points
 * Determines data quality tier for compliance reporting
 */
export type SourceType =
  | 'user_provided'       // Tier 3: Manual entry
  | 'supplier_provided'   // Tier 2: Direct supplier data
  | 'platform_estimate'   // Tier 3: Generic estimate
  | 'linked_lca_report';  // Tier 1: Verified LCA report
```

### 4. Version API Contracts

For breaking changes:
```typescript
// Old version (deprecated)
export interface CreateDataPointV1 { /* ... */ }

// New version (current)
export interface CreateDataPointV2 { /* ... */ }

// Alias for convenience
export type CreateDataPoint = CreateDataPointV2;
```

### 5. Separate Concerns

Organise types by domain:
- `lib/types/lca.ts` - LCA-specific types
- `lib/types/facilities.ts` - Facility management
- `lib/types/suppliers.ts` - Supply chain
- `lib/types/common.ts` - Shared utilities

### 6. Export Everything

Make all types available:
```typescript
// lib/types/index.ts
export * from './lca';
export * from './facilities';
export * from './suppliers';
export * from './common';
```

Import conveniently:
```typescript
import { OpenLcaProcess, Facility, Supplier } from '@/lib/types';
```

## Future Enhancements

### 1. Monorepo Shared Package

Create `packages/types/`:
```
packages/
  types/
    src/
      lca.ts
      facilities.ts
      index.ts
    package.json
    tsconfig.json
```

Both frontend and Edge Functions import from shared package.

### 2. Runtime Validation

Combine types with validation libraries:

```typescript
import { z } from 'zod';

// Define schema
export const CreateDataPointSchema = z.object({
  sourceType: z.enum(['user_provided', 'supplier_provided', ...]),
  dataPayload: z.object({ /* ... */ }),
  // ...
});

// Infer TypeScript type
export type CreateDataPointRequest = z.infer<typeof CreateDataPointSchema>;

// Runtime validation
const validated = CreateDataPointSchema.parse(input);
```

### 3. OpenAPI/Swagger Generation

Generate API documentation from types:
- Install: `openapi-typescript`
- Generate: `openapi-typescript schema.yaml --output types.ts`
- Deploy: Interactive API explorer

### 4. Type Guards

Create runtime type checkers:
```typescript
export function isOpenLcaProcess(obj: any): obj is OpenLcaProcess {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.category === 'string'
  );
}
```

### 5. Branded Types

Add type-level constraints:
```typescript
// Ensure IDs are not mixed up
type OpenLcaProcessId = string & { __brand: 'OpenLcaProcessId' };
type FacilityId = string & { __brand: 'FacilityId' };

// Compiler prevents: openLcaId = facilityId
```

## Migration Path

### Phase 1: Current State ✅

- Types defined in `lib/types/lca.ts`
- Frontend imports from `@/lib/types/lca`
- Backend duplicates types in Edge Functions
- Manual synchronisation required

### Phase 2: Deno Import Configuration

- Configure Deno import maps
- Edge Functions import from `lib/types/`
- Single source of truth
- Automatic synchronisation

### Phase 3: Shared Package

- Extract to `packages/types/`
- Publish to private npm registry
- Version independently
- Full monorepo integration

## Metrics for Success

Track improvements:

- **Build Failures Prevented:** Count TypeScript errors caught
- **Integration Bugs Reduced:** Measure contract violation bugs
- **Development Time:** Survey engineers on velocity
- **Onboarding Time:** Track new engineer ramp-up
- **API Changes:** Count breaking vs non-breaking changes

## Conclusion

Shared type definitions are a cornerstone of our full-stack TypeScript architecture. They provide compile-time safety, accelerate development, improve documentation, and reduce integration errors.

**Key Principles:**
1. **Single Source of Truth:** One definition, used everywhere
2. **Fail Fast:** Catch errors at compile time, not runtime
3. **Self-Documenting:** Types explain themselves
4. **Refactor Safely:** Changes propagate automatically
5. **Develop Faster:** IntelliSense and autocomplete

This strategy decision establishes a pattern to follow for all future API development across our application.

---

**Status:** Implemented
**Owner:** Engineering Team
**Last Updated:** 2025-11-12
**Next Review:** When transitioning to Phase 2 (Deno imports)
