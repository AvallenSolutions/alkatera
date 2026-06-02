import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import {
  getSupplierEsgCoverage,
  getSupplierClimateCoverage,
} from '@/lib/certifications/supplier-esg-evidence';

/**
 * GET /api/certifications/supplier-esg-coverage
 *
 * Org-scoped supplier ESG coverage for the B Corp supply-chain view:
 *  - `esg`: Tier-1 (fallback all) coverage for the Human Rights requirements (IT4),
 *    with per-supplier breakdown, score averages and rating distribution.
 *  - `climate`: value-chain climate engagement for Scope 3 (IT5-Y3-001).
 *
 * getSupabaseAPIClient() returns a service-role DB client after verifying the user,
 * which is required because supplier_esg_assessments is RLS-protected to the
 * supplier's own org. Org scoping is enforced via resolveUserOrganization().
 */
export async function GET(_request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, error: orgError } = await resolveUserOrganization(
      supabase,
      user,
    );
    if (orgError || !organizationId) {
      return NextResponse.json(
        { error: orgError || 'No organisation found' },
        { status: 403 },
      );
    }

    const [esg, climate] = await Promise.all([
      getSupplierEsgCoverage(supabase, organizationId),
      getSupplierClimateCoverage(supabase, organizationId),
    ]);

    return NextResponse.json({ esg, climate });
  } catch (error) {
    console.error('Error in GET /api/certifications/supplier-esg-coverage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
