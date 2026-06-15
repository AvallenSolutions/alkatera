import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import {
  calculateCertificationReadiness,
  persistScoreHistory,
} from '@/lib/certifications/readiness';
import { computeProbeHealth } from '@/lib/certifications/platform-probes';
import {
  isGeneralisedFramework,
  getRequirementDef,
} from '@/lib/certifications/frameworks';
import { getBcorpV21Requirement } from '@/lib/certifications/frameworks/bcorp-v2';

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
    if (frameworkCode === 'bcorp_2026' && readiness.hasCertification) {
      // B Corp v2.1 auto-evidence is driven by the content module's probes,
      // the same shared engine the other frameworks use.
      try {
        const items = readiness.requirementStatuses.map((rs) => ({
          code: rs.code,
          probe: getBcorpV21Requirement(rs.code)?.probe ?? null,
        }));
        platformHealth = await computeProbeHealth(supabase, organizationId, items);
      } catch (err) {
        console.error('computeProbeHealth (bcorp) failed:', err);
      }
    } else if (isGeneralisedFramework(frameworkCode)) {
      // ISO 14001 / 50001 / EcoVadis: data-quality from the shared probes.
      // Runs regardless of an active certification row, since these frameworks
      // are tracked before a formal certification engagement exists.
      try {
        const items = readiness.requirementStatuses.map((rs) => ({
          code: rs.code,
          probe: getRequirementDef(frameworkCode, rs.code)?.probe ?? null,
        }));
        platformHealth = await computeProbeHealth(supabase, organizationId, items);
      } catch (err) {
        console.error('computeProbeHealth failed:', err);
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
