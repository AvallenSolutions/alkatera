import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';

/**
 * POST /api/distributor/scraping/trigger
 * Body: { brand_profile_id?: string }
 *
 * If brand_profile_id is omitted, queues every brand in the caller's org.
 * Owner / data_manager only — viewers cannot kick off scraping runs.
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { brand_profile_id?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is acceptable — means "queue all brands".
  }

  let brandProfileIds: string[] | undefined;
  if (typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0) {
    // Verify the brand actually belongs to this distributor before
    // accepting it (defence in depth — RLS would also catch this).
    const { data: brand } = await auth.supabase
      .from('brand_profiles')
      .select('id')
      .eq('id', body.brand_profile_id)
      .eq('distributor_org_id', auth.organization.id)
      .maybeSingle();
    if (!brand) {
      return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
    }
    brandProfileIds = [body.brand_profile_id];
  }

  try {
    // Manual trigger means the distributor explicitly asked for a
    // re-scrape — bypass the directory-first gate so they always get
    // the freshest data possible.
    const result = await queueBrandsForScraping({
      supabase: auth.supabase,
      distributorOrgId: auth.organization.id,
      brandProfileIds,
      triggeredBy: 'manual',
      forceScrape: true,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'queue_failed', detail: message }, { status: 500 });
  }
}
