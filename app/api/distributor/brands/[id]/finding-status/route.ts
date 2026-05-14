import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/brands/[id]/finding-status
 *
 * Returns the latest data-finding job for a single brand, plus a count
 * of total findings on file. Drives the live "Finding…" indicator on
 * the brand detail page — the client polls this while a job is queued
 * or running, and stops once it settles.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // Make sure the brand belongs to the caller's org (RLS would also
  // catch this; explicit eq() is defence in depth).
  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id, brand_directory_id')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const brandDirectoryId = (brand as { brand_directory_id: string }).brand_directory_id;

  const { data: latestJob } = await auth.supabase
    .from('scraping_jobs')
    .select('id, status, triggered_by, started_at, completed_at, sources_attempted, sources_succeeded, error_message, created_at')
    .eq('brand_profile_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: findings_total } = await auth.supabase
    .from('scraped_brand_data')
    .select('id', { count: 'exact', head: true })
    .eq('brand_directory_id', brandDirectoryId)
    .is('superseded_by', null);

  return NextResponse.json({
    latest_job: latestJob ?? null,
    findings_total: findings_total ?? 0,
  });
}
