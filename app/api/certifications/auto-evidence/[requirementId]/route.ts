import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import { queryPlatformEvidence } from '@/lib/certifications/platform-data';
import { queryProbeEvidence } from '@/lib/certifications/platform-probes';
import {
  frameworkCodeForId,
  getRequirementDef,
} from '@/lib/certifications/frameworks';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { requirementId: string } },
) {
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

    const requirementId = params.requirementId;

    const { data: reqRow } = await supabase
      .from('certification_framework_requirements')
      .select('id, requirement_code, framework_id')
      .eq('id', requirementId)
      .maybeSingle();

    if (!reqRow) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 },
      );
    }

    // The cert FK + evidence lookups are scoped to the requirement's own
    // framework. For generalised frameworks (ISO 14001/50001, EcoVadis) the
    // auto-evidence comes from the shared probes; for B Corp it comes from the
    // B Corp module mappings.
    const generalisedCode = frameworkCodeForId(reqRow.framework_id);
    const frameworkId =
      reqRow.framework_id ?? (await getBcorpFrameworkId(supabase));

    const platform = generalisedCode
      ? await queryProbeEvidence(
          supabase,
          getRequirementDef(generalisedCode, reqRow.requirement_code)?.probe ?? null,
          organizationId,
        )
      : await queryPlatformEvidence(
          supabase,
          reqRow.requirement_code,
          organizationId,
        );

    if (!platform) {
      // No platform mapping for this requirement (manual evidence only).
      return NextResponse.json({
        mapped: false,
        platform: null,
        suggestions: [],
      });
    }

    // Resolve the active cert for the certification_id FK.
    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Upsert one auto-evidence row per found item.
    for (const item of platform.items) {
      const sourceRecordId = UUID_RE.test(item.sourceRecordId)
        ? item.sourceRecordId
        : null;
      const key = {
        organization_id: organizationId,
        requirement_id: requirementId,
        source_module: platform.module,
        source_record_id: sourceRecordId,
      };
      const { data: existing } = await supabase
        .from('certification_auto_evidence')
        .select('id, status, source_summary')
        .match(key)
        .maybeSingle();

      if (!existing) {
        await supabase.from('certification_auto_evidence').insert({
          ...key,
          certification_id: cert?.id ?? null,
          source_label: item.label,
          source_summary: item.summary,
          completeness_flag: platform.completeness,
          completeness_note: platform.completenessNote,
          status: 'suggested',
        });
      } else if (
        existing.status === 'dismissed' &&
        existing.source_summary === item.summary
      ) {
        // Dismissed and unchanged: leave it dismissed (do not resurface).
        continue;
      } else if (existing.status !== 'accepted') {
        await supabase
          .from('certification_auto_evidence')
          .update({
            source_label: item.label,
            source_summary: item.summary,
            completeness_flag: platform.completeness,
            completeness_note: platform.completenessNote,
            status: 'suggested',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
    }

    const { data: suggestions } = await supabase
      .from('certification_auto_evidence')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('requirement_id', requirementId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      mapped: true,
      platform: {
        module: platform.module,
        moduleLabel: platform.moduleLabel,
        moduleLink: platform.moduleLink,
        found: platform.found,
        completeness: platform.completeness,
        completenessNote: platform.completenessNote,
      },
      suggestions: suggestions ?? [],
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/auto-evidence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { requirementId: string } },
) {
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
    if (!body.auto_evidence_id) {
      return NextResponse.json(
        { error: 'auto_evidence_id is required' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('certification_auto_evidence')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', body.auto_evidence_id)
      .eq('organization_id', organizationId)
      .eq('requirement_id', params.requirementId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to dismiss suggestion' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/certifications/auto-evidence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
