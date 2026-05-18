import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import { recalculateAndNotify } from '@/lib/certifications/recalculate';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!body.auto_evidence_id) {
      return NextResponse.json(
        { error: 'auto_evidence_id is required' },
        { status: 400 },
      );
    }

    const { data: suggestion } = await supabase
      .from('certification_auto_evidence')
      .select('*')
      .eq('id', body.auto_evidence_id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 },
      );
    }

    const frameworkId = await getBcorpFrameworkId(supabase);
    const sourceRecordId =
      suggestion.source_record_id &&
      UUID_RE.test(String(suggestion.source_record_id))
        ? suggestion.source_record_id
        : null;

    const { data: evidence, error: evidenceError } = await supabase
      .from('certification_evidence_links')
      .insert({
        organization_id: organizationId,
        framework_id: frameworkId,
        requirement_id: suggestion.requirement_id,
        evidence_type: 'data_link',
        source_module: suggestion.source_module,
        source_table: suggestion.source_module,
        source_record_id: sourceRecordId,
        evidence_description: `${suggestion.source_label}: ${suggestion.source_summary}`,
        verification_status: 'verified',
        verified_by: 'platform_data',
        verification_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (evidenceError) {
      console.error('Error creating evidence from suggestion:', evidenceError);
      return NextResponse.json(
        { error: 'Failed to create evidence' },
        { status: 500 },
      );
    }

    await supabase
      .from('certification_auto_evidence')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', suggestion.id);

    try {
      await recalculateAndNotify(
        supabase,
        organizationId,
        suggestion.certification_id ?? null,
      );
    } catch (e) {
      console.error('recalc after auto-evidence accept failed:', e);
    }

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    console.error(
      'Error in POST /api/certifications/auto-evidence/accept:',
      error,
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
