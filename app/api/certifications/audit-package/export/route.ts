import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { generateAuditPackage } from '@/lib/certifications/audit-package';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
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

    const denied = await denyReadOnlyAdvisor(supabase, user, organizationId);
    if (denied) return denied;

    const body = await request.json();
    if (!body.package_id) {
      return NextResponse.json(
        { error: 'package_id is required' },
        { status: 400 },
      );
    }

    const result = await generateAuditPackage(
      supabase,
      organizationId,
      body.package_id,
      {
        includePending: body.include_pending === true,
        layout: body.layout === 'bia' ? 'bia' : 'requirement',
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(
      'Error in POST /api/certifications/audit-package/export:',
      error,
    );
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
