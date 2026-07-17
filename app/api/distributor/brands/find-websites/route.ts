import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { inngest } from '@/lib/inngest/client';

/**
 * Brand website backfill — find official websites (Gemini grounded search) for
 * brands with none, save them, and queue a fresh scrape. Website discovery
 * otherwise only runs once, at SKU-import time, so brands imported before it
 * worked stay empty forever; this is the on-demand self-heal path.
 *
 * GET  → status counts the client polls: { total_brands, without_website }.
 * POST → dispatches `distributor/find-websites.run` to Inngest and returns 202.
 *        Body: { brand_profile_id? } — one brand, or the whole portfolio.
 *
 * Why Inngest: a single grounded-search call reliably takes 40-60s, so any
 * synchronous request blows a serverless function's sync ceiling (the route
 * used to 504 on Netlify). The client tracks progress by polling GET and
 * watching `without_website` fall — no job table.
 *
 * Owner / data_manager only.
 */

export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const orgId = auth.organization.id;

  // Poll a specific run for its outcome (found count + grounded-search errors).
  const runId = new URL(request.url).searchParams.get('run_id');
  if (runId) {
    const { data: run } = await auth.supabase
      .from('distributor_backfill_runs')
      .select('id, status, total, found, queued, gemini_configured, errors, samples, message')
      .eq('id', runId)
      .eq('distributor_org_id', orgId)
      .maybeSingle();
    return NextResponse.json({ run: run ?? null });
  }

  const { count: total } = await auth.supabase
    .from('brand_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_org_id', orgId)
    .eq('listing_status', 'active');

  const { count: without } = await auth.supabase
    .from('brand_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_org_id', orgId)
    .eq('listing_status', 'active')
    .is('website', null);

  return NextResponse.json({
    total_brands: total ?? 0,
    without_website: without ?? 0,
  });
}

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
    // Empty body = backfill the whole portfolio.
  }
  const singleBrandId =
    typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0
      ? body.brand_profile_id
      : null;

  const orgId = auth.organization.id;

  // How many brands this run will attempt (the client's progress baseline).
  let countQuery = auth.supabase
    .from('brand_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_org_id', orgId)
    .eq('listing_status', 'active')
    .is('website', null);
  if (singleBrandId) countQuery = countQuery.eq('id', singleBrandId);
  const { count } = await countQuery;
  const total = count ?? 0;

  if (total === 0) {
    return NextResponse.json({
      status: 'noop',
      total: 0,
      message: 'No brands without a website to look up.',
    });
  }

  // Create a run row the Inngest function will write its outcome onto.
  const { data: run } = await auth.supabase
    .from('distributor_backfill_runs')
    .insert({
      distributor_org_id: orgId,
      kind: 'find_websites',
      status: 'running',
      total,
    })
    .select('id')
    .single();
  const runId = run?.id ?? null;

  // Fire-and-forget: the client polls GET for progress either way. Runs
  // identically in local dev (via the Inngest dev server) and production.
  inngest
    .send({
      name: 'distributor/find-websites.run',
      data: { distributor_org_id: orgId, brand_profile_id: singleBrandId, run_id: runId },
    })
    .catch(async (err) => {
      console.error('[find-websites] inngest.send failed:', err);
      if (runId) {
        await auth.supabase
          .from('distributor_backfill_runs')
          .update({
            status: 'error',
            message: err instanceof Error ? err.message : 'dispatch_failed',
            finished_at: new Date().toISOString(),
          })
          .eq('id', runId);
      }
    });

  return NextResponse.json(
    { status: 'processing', total, runId, mode: singleBrandId ? 'single' : 'bulk' },
    { status: 202 },
  );
}
