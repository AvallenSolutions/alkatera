import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';
import { recalculateAndNotify } from '@/lib/certifications/recalculate';

function extractCodes(changeLog: unknown): string[] {
  if (!Array.isArray(changeLog)) return [];
  return changeLog
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && 'code' in entry
          ? String((entry as { code: unknown }).code)
          : null,
    )
    .filter((c): c is string => !!c);
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
    const { data: versions } = await supabase
      .from('certification_standards_versions')
      .select('*')
      .eq('framework_id', frameworkId)
      .order('released_at', { ascending: false });

    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('standards_version')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = versions?.[0] ?? null;
    const current = cert?.standards_version ?? null;
    const needsReview =
      !!latest && current !== null && current !== latest.version_code;

    return NextResponse.json({
      versions: versions ?? [],
      latest,
      current,
      needsReview: needsReview || (!current && !!latest),
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/standards:', error);
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
    if (!body.version_code) {
      return NextResponse.json(
        { error: 'version_code is required' },
        { status: 400 },
      );
    }

    const frameworkId = await getBcorpFrameworkId(supabase);
    const { data: version } = await supabase
      .from('certification_standards_versions')
      .select('version_code, change_log')
      .eq('framework_id', frameworkId)
      .eq('version_code', body.version_code)
      .maybeSingle();

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 },
      );
    }

    const codes = extractCodes(version.change_log);
    let affected = 0;

    if (codes.length > 0) {
      const { data: reqs } = await supabase
        .from('certification_framework_requirements')
        .select('id')
        .eq('framework_id', frameworkId)
        .in('requirement_code', codes);
      const reqIds = (reqs ?? []).map((r: any) => r.id);
      if (reqIds.length > 0) {
        const { data: updated } = await supabase
          .from('certification_evidence_links')
          .update({
            verification_status: 'needs_review',
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', organizationId)
          .eq('verification_status', 'verified')
          .in('requirement_id', reqIds)
          .select('id');
        affected = (updated ?? []).length;
      }
    }

    const { data: cert } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('framework_id', frameworkId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cert) {
      await supabase
        .from('organization_certifications')
        .update({
          standards_version: version.version_code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cert.id);
      try {
        await recalculateAndNotify(supabase, organizationId, cert.id);
      } catch (e) {
        console.error('recalc after standards apply failed:', e);
      }
    }

    return NextResponse.json({ affected, version: version.version_code });
  } catch (error) {
    console.error('Error in POST /api/certifications/standards:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
