import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import {
  calculateCertificationReadiness,
  getBcorpFrameworkId,
} from '@/lib/certifications/readiness';
import { renderRecertReportHtml } from '@/lib/certifications/render-audit-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
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

    const frameworkId = await getBcorpFrameworkId(supabase);
    const readiness = await calculateCertificationReadiness(
      supabase,
      organizationId,
    );
    if (!readiness.hasCertification) {
      return NextResponse.json(
        { error: 'No active certification' },
        { status: 404 },
      );
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();

    const year3 = readiness.requirementStatuses.filter(
      (r) => r.applicableFromYear === 3,
    );
    const year5 = readiness.requirementStatuses.filter(
      (r) => r.applicableFromYear === 5,
    );

    const { data: history } = await supabase
      .from('certification_score_history')
      .select('score_date, health_score')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .not('health_score', 'is', null)
      .order('score_date', { ascending: true })
      .limit(24);

    const html = renderRecertReportHtml({
      organisationName: org?.name ?? 'Organisation',
      certificationStartDate: readiness.certificationStartDate,
      year3Met: year3.filter((r) => r.status === 'passed').length,
      year3Total: year3.length,
      year5Met: year5.filter((r) => r.status === 'passed').length,
      year5Total: year5.length,
      healthTrend: (history ?? []).map((h: any) => ({
        date: h.score_date,
        score: h.health_score,
      })),
    });

    const pdf = await convertHtmlToPdf(html);

    return new NextResponse(pdf.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="recertification-readiness-report.pdf"',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/certifications/recert-report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
