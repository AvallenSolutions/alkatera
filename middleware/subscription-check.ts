import { NextResponse } from 'next/server';
import {
  checkProductLimit,
  checkLCALimit,
  checkReportLimit,
  checkFeatureAccess,
} from '@/lib/subscription-limits';

/**
 * Subscription Limit Enforcement Middleware
 *
 * This module provides middleware functions to enforce subscription limits
 * before allowing operations like creating products, LCAs, or generating reports.
 *
 * Usage in API routes:
 *
 * ```typescript
 * import { enforceProductLimit } from '@/middleware/subscription-check';
 *
 * export async function POST(request: NextRequest) {
 *   const limitCheck = await enforceProductLimit(organizationId);
 *   if (limitCheck) return limitCheck; // Returns 403 if limit exceeded
 *
 *   // Continue with product creation...
 * }
 * ```
 */

// ============================================================================
// Limit Enforcement Functions
// ============================================================================

/**
 * Enforce product creation limit
 * Returns NextResponse with error if limit exceeded, null if allowed
 */
export async function enforceProductLimit(
  organizationId: string
): Promise<NextResponse | null> {
  const check = await checkProductLimit(organizationId);

  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'Product limit reached',
        message: check.reason,
        limit: {
          current: check.current,
          max: check.max,
          tier: check.tier,
        },
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Enforce LCA creation limit
 * Returns NextResponse with error if limit exceeded, null if allowed
 */
export async function enforceLCALimit(
  organizationId: string
): Promise<NextResponse | null> {
  const check = await checkLCALimit(organizationId);

  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'LCA limit reached',
        message: check.reason,
        limit: {
          current: check.current,
          max: check.max,
          tier: check.tier,
        },
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Enforce report generation limit
 * Returns NextResponse with error if limit exceeded, null if allowed
 */
export async function enforceReportLimit(
  organizationId: string
): Promise<NextResponse | null> {
  const check = await checkReportLimit(organizationId);

  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'Report limit reached',
        message: check.reason,
        limit: {
          current: check.current,
          max: check.max,
          tier: check.tier,
        },
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Enforce feature access
 * Returns NextResponse with error if feature not available, null if allowed
 */
export async function enforceFeatureAccess(
  organizationId: string,
  featureCode: string
): Promise<NextResponse | null> {
  const check = await checkFeatureAccess(organizationId, featureCode);

  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'Feature not available',
        message: check.reason,
        feature: featureCode,
        tier: check.tier,
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  return null;
}

// ============================================================================
// Subscription Status Checks
// ============================================================================

/**
 * Check if organization has an active subscription
 * This is a general check that can be used as a first line of defense
 */
export async function checkSubscriptionActive(
  organizationId: string
): Promise<{ active: boolean; status: string; tier: string }> {
  // This would query the database to check subscription status
  // For now, returning a placeholder
  // TODO: Implement actual database check
  return {
    active: true,
    status: 'active',
    tier: 'seed',
  };
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
Example usage in product creation API:

```typescript
// app/api/products/route.ts
import { enforceProductLimit } from '@/middleware/subscription-check';
import { incrementProductCount } from '@/lib/subscription-limits';

export async function POST(request: NextRequest) {
  const { organizationId, ...productData } = await request.json();

  // Check limit before creating
  const limitCheck = await enforceProductLimit(organizationId);
  if (limitCheck) return limitCheck;

  // Create product
  const product = await createProduct(productData);

  // Increment count after successful creation
  await incrementProductCount(organizationId, userId);

  return NextResponse.json(product);
}
```

Example usage in LCA calculation API:

```typescript
// app/api/lca/calculate/route.ts
import { enforceLCALimit, enforceFeatureAccess } from '@/middleware/subscription-check';

export async function POST(request: NextRequest) {
  const { organizationId, methodology } = await request.json();

  // Check LCA limit
  const limitCheck = await enforceLCALimit(organizationId);
  if (limitCheck) return limitCheck;

  // Check methodology access (e.g., EF 3.1 requires premium+)
  if (methodology === 'ef_31') {
    const featureCheck = await enforceFeatureAccess(organizationId, 'ef_31');
    if (featureCheck) return featureCheck;
  }

  // Proceed with calculation...
}
```

Example usage in report generation:

```typescript
// app/api/reports/generate/route.ts
import { enforceReportLimit } from '@/middleware/subscription-check';
import { incrementReportCount } from '@/lib/subscription-limits';

export async function POST(request: NextRequest) {
  const { organizationId, reportType } = await request.json();

  // Check report limit
  const limitCheck = await enforceReportLimit(organizationId);
  if (limitCheck) return limitCheck;

  // Generate report
  const report = await generateReport(reportType);

  // Increment report count
  await incrementReportCount(organizationId, userId);

  return NextResponse.json(report);
}
```
*/
