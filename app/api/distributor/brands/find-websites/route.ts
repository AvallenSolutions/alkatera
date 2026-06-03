import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * Brand website backfill — find official websites (Gemini grounded search) for
 * brands with none, save them, and queue a fresh scrape. Website discovery
 * otherwise only runs once, at SKU-import time, so brands imported before it
 * worked stay empty forever; this is the on-demand self-heal path.
 *
 * GET  → status counts the client polls: { total_brands, without_website }.
 * POST → kicks off the work in a Netlify background function and returns 202.
 *        Body: { brand_profile_id? } — one brand, or the whole portfolio.
 *
 * Why a background function: a single grounded-search call reliably takes
 * 40-60s, so any synchronous request blows Netlify's ~26s ceiling (the route
 * used to 504). The -background runner has a 15-minute window. The client tracks
 * progress by polling GET and watching `without_website` fall — no job table.
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

  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
  if (!hmacSecret) {
    console.error('[find-websites] INTERNAL_JOB_HMAC_SECRET not set');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  // Create a run row the background function will write its outcome onto.
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

  const payload = JSON.stringify({
    distributorOrgId: orgId,
    brandProfileId: singleBrandId ?? undefined,
    runId: runId ?? undefined,
  });
  const signature = createHmac('sha256', hmacSecret).update(payload).digest('hex');

  // Local dev (`pnpm dev`) doesn't run Netlify functions, so a fetch to
  // /.netlify/functions/... would 404. Invoke the handler in-process instead —
  // Next dev has no 26s synchronous cap. Fire-and-forget either way; the client
  // polls GET for progress.
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.NETLIFY;
  if (isDev) {
    void (async () => {
      try {
        const { handler } = await import('@/netlify/functions/find-websites-background');
        await handler({ body: payload, headers: { 'x-internal-hmac': signature } });
      } catch (err) {
        console.error('[find-websites] inline runner failed:', err);
      }
    })();
  } else {
    const baseUrl =
      process.env.URL || process.env.DEPLOY_URL || `https://${request.headers.get('host')}`;
    const target = `${baseUrl}/.netlify/functions/find-websites-background`;
    void fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
      body: payload,
    }).catch((err) => {
      console.error('[find-websites] failed to trigger background function:', err);
    });
  }

  return NextResponse.json(
    { status: 'processing', total, runId, mode: singleBrandId ? 'single' : 'bulk' },
    { status: 202 },
  );
}
