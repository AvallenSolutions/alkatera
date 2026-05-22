import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import {
  calculateCertificationReadiness,
  getBcorpFrameworkId,
} from '@/lib/certifications/readiness';

async function resolveEmployeeCount(
  supabase: any,
  organizationId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('people_workforce_demographics')
    .select('employee_count, reporting_year')
    .eq('organization_id', organizationId)
    .order('reporting_year', { ascending: false })
    .limit(50);
  if (!data || data.length === 0) return null;
  const latestYear = data[0].reporting_year;
  const total = data
    .filter((r: any) => r.reporting_year === latestYear)
    .reduce((sum: number, r: any) => sum + (r.employee_count ?? 0), 0);
  return total > 0 ? total : null;
}

export async function GET() {
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
    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id, pre_audit_checklist')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const readiness = await calculateCertificationReadiness(
      supabase,
      organizationId,
      cert?.id ?? null,
    );
    const employeeCount = await resolveEmployeeCount(supabase, organizationId);

    return NextResponse.json({
      certificationId: cert?.id ?? null,
      checklist: cert?.pre_audit_checklist ?? {},
      derived: {
        foundationComplete: readiness.foundationComplete,
        riskToolComplete: readiness.riskToolComplete,
        year0Complete: readiness.isReadyToSubmit,
        employeeCount,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/checklist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    if (typeof body.checklist !== 'object' || body.checklist === null) {
      return NextResponse.json(
        { error: 'checklist object is required' },
        { status: 400 },
      );
    }

    const frameworkId = await getBcorpFrameworkId(supabase);
    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cert) {
      return NextResponse.json(
        { error: 'No active certification' },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from('organization_certifications')
      .update({
        pre_audit_checklist: body.checklist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cert.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save checklist' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/certifications/checklist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
