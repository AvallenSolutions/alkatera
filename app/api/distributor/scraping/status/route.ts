import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/scraping/status
 * Returns a per-status summary of scraping_jobs for the caller's org,
 * plus the 20 most recent jobs for the activity feed.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data: counts, error: countsError } = await auth.supabase
    .from('scraping_jobs')
    .select('status')
    .eq('distributor_org_id', auth.organization.id);
  if (countsError) {
    return NextResponse.json({ error: countsError.message }, { status: 500 });
  }
  const summary: Record<string, number> = {
    queued: 0,
    running: 0,
    complete: 0,
    error: 0,
    skipped: 0,
  };
  for (const row of (counts as Array<{ status: string }>) ?? []) {
    summary[row.status] = (summary[row.status] ?? 0) + 1;
  }

  const { data: recent } = await auth.supabase
    .from('scraping_jobs')
    .select('id, brand_profile_id, status, triggered_by, started_at, completed_at, sources_attempted, sources_succeeded, error_message, created_at')
    .eq('distributor_org_id', auth.organization.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    summary,
    recent: recent ?? [],
  });
}
