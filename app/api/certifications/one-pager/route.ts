import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { calculateCertificationReadiness } from '@/lib/certifications/readiness';
import { topActions } from '@/lib/certifications/roadmap';
import { getRecertDelta } from '@/lib/certifications/recert-deltas';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { renderBcorpOnePagerHtml } from '@/lib/pdf/render-bcorp-onepager-html';
import { enforceExportAllowed } from '@/middleware/subscription-check';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/certifications/one-pager
 *
 * Generates an exec-ready, one-page B Corp readiness summary PDF and returns it
 * for download.
 */
export async function POST() {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { organizationId, error: orgError } = await resolveUserOrganization(supabase, user);
    if (orgError || !organizationId) {
      return NextResponse.json({ error: orgError || 'No organisation found' }, { status: 403 });
    }

    const exportBlocked = await enforceExportAllowed(organizationId);
    if (exportBlocked) return exportBlocked;

    const readiness = await calculateCertificationReadiness(supabase, organizationId);
    if (!readiness.hasCertification) {
      return NextResponse.json(
        { error: 'No B Corp certification started yet — nothing to summarise.' },
        { status: 400 },
      );
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const generatedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let recertDeltas: { new: number; changed: number; carried_over: number } | null = null;
    if (readiness.certificationType === 'recertification') {
      recertDeltas = { new: 0, changed: 0, carried_over: 0 };
      for (const rs of readiness.requirementStatuses.filter((r) => r.applicable !== false)) {
        recertDeltas[getRecertDelta(rs.code, rs.topicArea, rs.applicableFromYear).kind] += 1;
      }
    }

    const html = renderBcorpOnePagerHtml({
      orgName: org?.name || 'Your organisation',
      generatedAt,
      certificationType: readiness.certificationType,
      currentYearBand: readiness.currentYearBand,
      year0ReadinessPct: readiness.year0ReadinessPct,
      programmeReadinessPct: readiness.programmeReadinessPct,
      readyToSubmit: readiness.isReadyToSubmit,
      blockingCount: readiness.blockingRequirements.length,
      nextActions: topActions(readiness, 6).map((a) => ({ code: a.code, name: a.name, bucket: a.bucket, reason: a.reason })),
      recertDeltas,
    });

    const { buffer } = await convertHtmlToPdf(html, { format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' } });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="bcorp-readiness-summary.pdf"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/certifications/one-pager:', error);
    return NextResponse.json({ error: 'Failed to generate the summary' }, { status: 500 });
  }
}
