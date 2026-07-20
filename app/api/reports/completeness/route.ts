import { NextRequest, NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/reports/route-auth';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  computeAllSectionCompleteness,
  isCompletenessSection,
  type SectionReportData,
} from '@/lib/reports/section-completeness';
import { gatherPeopleCulture } from '@/lib/reports/sections/people-culture';
import { gatherGovernance } from '@/lib/reports/sections/governance';
import { gatherCommunityImpact } from '@/lib/reports/sections/community-impact';
import { gatherSupplyChain } from '@/lib/reports/sections/supply-chain';
import { gatherFacilities } from '@/lib/reports/sections/facilities';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/reports/completeness?year=2026&sections=people-culture,governance
 *
 * Per-measure completeness for the social and value-chain report sections,
 * for the builder's funnel ("3 of 9 measures recorded", with deep links to
 * the missing ones). Runs the SAME gathers and the SAME pure catalogue as
 * the assembler (lib/reports/section-completeness.ts), so the builder and
 * the finished document agree by construction. Replaces the deleted
 * /api/reports/preview-data, which counted four tables that did not exist.
 *
 * Bearer + RLS: the caller's own client does the reads, so a user only ever
 * sees completeness for data they can read anyway.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Missing authorisation' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const organizationId = await resolveAccessibleOrg(supabase, user, params.get('organization_id'));
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const year = Number(params.get('year')) || new Date().getFullYear();
    const requested = (params.get('sections') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const sections = (requested.length > 0
      ? requested
      : ['people-culture', 'governance', 'community-impact', 'supply-chain', 'facilities']
    ).filter(isCompletenessSection);

    const wants = (id: string) => sections.some(s => s === id || (id === 'people-culture' && s === 'people') || (id === 'community-impact' && s === 'community') || (id === 'supply-chain' && s === 'suppliers'));

    const soften = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await run();
      } catch {
        return undefined; // a failed gather reads as nothing-recorded, never a 500
      }
    };

    const [peopleCulture, governance, communityImpact, suppliers, facilities] = await Promise.all([
      wants('people-culture') ? soften(() => gatherPeopleCulture(supabase, organizationId, year)) : undefined,
      wants('governance') ? soften(() => gatherGovernance(supabase, organizationId, year)) : undefined,
      wants('community-impact') ? soften(() => gatherCommunityImpact(supabase, organizationId, year)) : undefined,
      wants('supply-chain') ? soften(() => gatherSupplyChain(supabase, organizationId, year)) : undefined,
      wants('facilities') ? soften(() => gatherFacilities(supabase, organizationId, year)) : undefined,
    ]);

    const payload: SectionReportData = { peopleCulture, governance, communityImpact, suppliers, facilities };
    return NextResponse.json({
      year,
      sections: computeAllSectionCompleteness(sections, payload),
    });
  } catch (error) {
    console.error('[reports/completeness]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
