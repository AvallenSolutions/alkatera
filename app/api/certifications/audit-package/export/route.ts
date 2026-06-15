import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization';
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
