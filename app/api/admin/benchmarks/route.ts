/**
 * Admin: the shape of our own benchmark data.
 *
 * Phase 2 of the internal-benchmarks plan, and the gate before Phase 3: we
 * look at the cohort before anybody is scored against it.
 *
 * GET  /api/admin/benchmarks — every bucket, INCLUDING those below the
 *      k-anonymity floor, with the literature comparison (step 5) attached to
 *      the ones that clear it.
 * POST /api/admin/benchmarks — dispatch the backfill. Body: { action: 'backfill' }.
 *
 * Buckets below the floor are visible HERE and nowhere else. That is the whole
 * point of the surface: we cannot judge whether a benchmark is worth shipping
 * without seeing the buckets that are not ready. The underlying function
 * exposes no organisation identity, only dimensions, counts and percentiles.
 *
 * Admin-gated with the same Bearer-token + is_alkatera_admin pattern as the
 * reference-data loader.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { checkBucketsAgainstLiterature } from '@/lib/benchmarks/literature-check';
import { MINIMUM_COHORT_ORGANIZATIONS, type PeerBucket } from '@/lib/benchmarks/ladder';
import { INTENSITY_METRIC_KEY } from '@/lib/benchmarks/product-intensity';

export const dynamic = 'force-dynamic';

// Next patches global fetch, and on a route that never touches next/headers it
// would otherwise cache these outbound Supabase reads across invocations — the
// same URL returning the first response it ever saw. no-store is what makes
// this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
  });

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin');
  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { global: { fetch: noStoreFetch } });
  return { admin, userClient };
}

type BucketRow = PeerBucket & { clears_k_anonymity: boolean };

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if ('error' in ctx) return ctx.error;
  const { admin, userClient } = ctx;

  // The RPC is SECURITY DEFINER and checks is_alkatera_admin() itself, so it
  // is called on the USER's client. Calling it service-role would run the
  // admin check as the service role and pass unconditionally, which would make
  // the function's own guard decorative.
  const { data: bucketData, error: bucketError } = await userClient.rpc(
    'get_product_intensity_buckets',
  );
  if (bucketError) {
    return NextResponse.json({ error: bucketError.message }, { status: 500 });
  }

  const buckets = ((bucketData ?? []) as BucketRow[]).map((b) => ({
    ...b,
    sample_size: Number(b.sample_size),
    organization_count: Number(b.organization_count),
    p25: Number(b.p25),
    p50: Number(b.p50),
    p75: Number(b.p75),
    mean_value: Number(b.mean_value),
  }));

  // Step 5. Not optional: if the engine carries a systematic bias, scoring
  // customers against each other hides it, because both sides carry the same
  // error. An external number is the only thing in the system that can
  // disagree with us.
  const literatureChecks = checkBucketsAgainstLiterature(buckets);

  // Coverage: how much of the catalogue actually made it into the cohort, and
  // when it was last written. A cohort that stopped being refreshed decays out
  // of the view's 365-day window silently, so the date matters.
  const [{ count: snapshotCount }, { data: latest }] = await Promise.all([
    admin
      .from('product_intensity_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('metric_key', INTENSITY_METRIC_KEY),
    admin
      .from('product_intensity_snapshots')
      .select('snapshot_date')
      .eq('metric_key', INTENSITY_METRIC_KEY)
      .order('snapshot_date', { ascending: false })
      .limit(1),
  ]);

  const { count: completedPcfCount } = await admin
    .from('product_carbon_footprints')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');

  return NextResponse.json({
    minimum_cohort: MINIMUM_COHORT_ORGANIZATIONS,
    coverage: {
      snapshot_rows: snapshotCount ?? 0,
      completed_pcfs: completedPcfCount ?? 0,
      last_snapshot_date: latest?.[0]?.snapshot_date ?? null,
    },
    buckets: buckets.sort(
      (a, b) =>
        Number(b.clears_k_anonymity) - Number(a.clears_k_anonymity) ||
        b.organization_count - a.organization_count,
    ),
    literature_checks: literatureChecks,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'backfill') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // Never inline: this walks every organisation. Without an event key
  // configured, Inngest send is a graceful no-op, so say so rather than
  // reporting a dispatch that went nowhere.
  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: 'INNGEST_EVENT_KEY is not configured, so the backfill cannot be dispatched.' },
      { status: 503 },
    );
  }

  await inngest.send({ name: 'benchmarks/intensity.backfill', data: {} });
  return NextResponse.json({ dispatched: true });
}
