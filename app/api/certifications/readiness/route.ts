import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import {
  calculateCertificationReadiness,
  persistScoreHistory,
} from '@/lib/certifications/readiness';
import {
  computePlatformHealth,
  getMappedRequirementCodes,
} from '@/lib/certifications/platform-data';

export async function GET(request: NextRequest) {
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

    const certificationId =
      request.nextUrl.searchParams.get('certification_id') || undefined;
    const frameworkCode =
      request.nextUrl.searchParams.get('framework_code') || 'bcorp_2026';

    const readiness = await calculateCertificationReadiness(
      supabase,
      organizationId,
      certificationId,
      frameworkCode,
    );

    // Best-effort history write; never block the response on it.
    if (readiness.hasCertification) {
      try {
        await persistScoreHistory(supabase, organizationId, readiness, frameworkCode);
      } catch (err) {
        console.error('persistScoreHistory failed:', err);
      }
    }

    // Data quality (Platform Health) from the auto-evidence mappings. Only the
    // B Corp mappings exist today; other frameworks get theirs in their content
    // phase and return an empty set until then.
    let platformHealth = readiness.platformHealth;
    if (readiness.hasCertification && frameworkCode === 'bcorp_2026') {
      try {
        const mapped = new Set(getMappedRequirementCodes());
        const codes = readiness.requirementStatuses
          .map((rs) => rs.code)
          .filter((c) => mapped.has(c));
        platformHealth = await computePlatformHealth(
          supabase,
          organizationId,
          codes,
        );
      } catch (err) {
        console.error('computePlatformHealth failed:', err);
      }
    }

    return NextResponse.json({ ...readiness, platformHealth });
  } catch (error) {
    console.error('Error in GET /api/certifications/readiness:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
