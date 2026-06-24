import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { computeHealthScore } from '@/lib/certifications/health-score';

export async function GET() {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 },
      );
    }

    const result = await computeHealthScore(supabase, organizationId);
    if (!result) {
      return NextResponse.json({ hasCertification: false });
    }
    return NextResponse.json({ hasCertification: true, ...result });
  } catch (error) {
    console.error('Error in GET /api/certifications/health-score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
