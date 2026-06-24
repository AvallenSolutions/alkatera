/**
 * Pulse -- CSRD/ESRS data-quality gap list.
 *
 * GET /api/pulse/csrd-gaps?organization_id=...
 *
 * Returns the evaluated rule set with severity, evidence and a deep-link
 * for each ESRS disclosure point.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { evaluateCsrdGaps } from '@/lib/pulse/csrd-gaps';

export const runtime = 'nodejs';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');

    const svc = serviceClient();

    // Member OR active advisor for the requested/selected org.
    const organizationId = await resolveAccessibleOrg(svc, user, orgIdParam);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 403 });
    }

    const { results, summary } = await evaluateCsrdGaps(svc, organizationId);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      summary,
      results,
    });
  } catch (err: any) {
    console.error('[pulse csrd-gaps]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
