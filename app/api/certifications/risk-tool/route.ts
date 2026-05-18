import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import { recalculateAndNotify } from '@/lib/certifications/recalculate';
import {
  computeRiskProfile,
  deriveTriggeredRequirements,
  isRiskToolComplete,
} from '@/lib/certifications/risk-tool-questions';

const RISK_TOOL_CODE = 'FR-R-000';

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

    const { data } = await supabase
      .from('organization_risk_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    console.error('Error in GET /api/certifications/risk-tool:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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
    const responses: Record<string, string> = body.responses ?? {};

    if (!isRiskToolComplete(responses)) {
      return NextResponse.json(
        { error: 'All Risk Tool questions must be answered' },
        { status: 400 },
      );
    }

    const frameworkId = await getBcorpFrameworkId(supabase);
    if (!frameworkId) {
      return NextResponse.json(
        { error: 'B Corp framework not found' },
        { status: 500 },
      );
    }

    const riskProfile = computeRiskProfile(responses);
    const triggered = deriveTriggeredRequirements(riskProfile);

    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: reqRow } = await supabase
      .from('certification_framework_requirements')
      .select('id')
      .eq('framework_id', frameworkId)
      .eq('requirement_code', RISK_TOOL_CODE)
      .maybeSingle();

    const completedAt = new Date().toISOString();

    const { data: savedProfile, error: profileError } = await supabase
      .from('organization_risk_profiles')
      .insert({
        organization_id: organizationId,
        certification_id: cert?.id ?? null,
        responses,
        risk_profile: riskProfile,
        triggered_requirements: triggered,
        completed_at: completedAt,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error saving risk profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to save risk profile' },
        { status: 500 },
      );
    }

    // Auto-create (or refresh) a verified evidence link for FR-R-000.
    if (reqRow?.id) {
      const description = `Risk Tool completed on ${completedAt.slice(0, 10)}`;
      const { data: existing } = await supabase
        .from('certification_evidence_links')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('requirement_id', reqRow.id)
        .eq('source_module', 'risk_tool')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('certification_evidence_links')
          .update({
            evidence_description: description,
            verification_status: 'verified',
            verified_by: 'risk_tool',
            verification_date: completedAt,
            source_record_id: savedProfile.id,
            updated_at: completedAt,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('certification_evidence_links').insert({
          organization_id: organizationId,
          framework_id: frameworkId,
          requirement_id: reqRow.id,
          evidence_type: 'data_link',
          source_module: 'risk_tool',
          source_table: 'organization_risk_profiles',
          source_record_id: savedProfile.id,
          evidence_description: description,
          verification_status: 'verified',
          verified_by: 'risk_tool',
          verification_date: completedAt,
        });
      }
    }

    try {
      await recalculateAndNotify(supabase, organizationId, cert?.id ?? null);
    } catch (e) {
      console.error('recalc after risk tool failed:', e);
    }

    return NextResponse.json(
      { profile: savedProfile, riskProfile, triggered },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in POST /api/certifications/risk-tool:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
