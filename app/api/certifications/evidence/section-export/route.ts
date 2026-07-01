import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { buildSectionExport, NoEvidenceError } from '@/lib/certifications/section-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const denied = await denyReadOnlyAdvisor(supabase, user, organizationId);
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const rawTopics: unknown = body.topics;
    const topicAreas =
      Array.isArray(rawTopics)
        ? (rawTopics as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
        : [];
    const includePending: boolean = body.include_pending === true;

    const result = await buildSectionExport(supabase, organizationId, {
      topicAreas: topicAreas.length > 0 ? topicAreas : undefined,
      includePending,
    });

    return NextResponse.json({ url: result.signedUrl, fileCount: result.fileCount });
  } catch (err) {
    if (err instanceof NoEvidenceError) {
      return NextResponse.json(
        { error: 'No evidence files found for the selected sections' },
        { status: 404 },
      );
    }
    console.error('[section-export] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
