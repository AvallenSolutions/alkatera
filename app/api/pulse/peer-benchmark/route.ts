import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * GET /api/pulse/peer-benchmark?organization_id=...
 *
 * For each metric the org has snapshots for, returns:
 *   - the org's latest value
 *   - peer p25 / p50 / p75 / mean from peer_benchmark_view (k≥5)
 *   - the org's percentile rank within the peer set
 *
 * The view enforces k-anonymity (≥5 distinct orgs per bucket); if a metric
 * doesn't meet the threshold, it's omitted from the response.
 */
export const runtime = 'nodejs';

interface PeerStat {
  metric_key: string;
  sample_size: number;
  p25: number;
  p50: number;
  p75: number;
  min_value: number;
  max_value: number;
  mean_value: number;
}

interface OrgSnapshot {
  metric_key: string;
  value: number;
  unit: string;
  snapshot_date: string;
}

export async function GET(request: NextRequest) {
  const orgId = new URL(request.url).searchParams.get('organization_id');
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Latest snapshot per metric for this org.
  const { data: orgRows } = await supabase
    .from('metric_snapshots')
    .select('metric_key, value, unit, snapshot_date')
    .eq('organization_id', orgId)
    .order('snapshot_date', { ascending: false });

  const orgLatest = new Map<string, OrgSnapshot>();
  for (const r of (orgRows ?? []) as OrgSnapshot[]) {
    if (!orgLatest.has(r.metric_key)) orgLatest.set(r.metric_key, r);
  }

  const { data: peerRows } = await supabase.from('peer_benchmark_view').select('*');
  const peerByMetric = new Map<string, PeerStat>();
  for (const p of (peerRows ?? []) as PeerStat[]) {
    peerByMetric.set(p.metric_key, p);
  }

  const benchmarks = Array.from(orgLatest.entries())
    .filter(([key]) => peerByMetric.has(key))
    .map(([key, org]) => {
      const peer = peerByMetric.get(key)!;
      return {
        metric_key: key,
        unit: org.unit,
        org_value: org.value,
        snapshot_date: org.snapshot_date,
        peer: {
          sample_size: peer.sample_size,
          p25: Number(peer.p25),
          p50: Number(peer.p50),
          p75: Number(peer.p75),
          min_value: Number(peer.min_value),
          max_value: Number(peer.max_value),
          mean_value: Number(peer.mean_value),
        },
        percentile: estimatePercentile(org.value, peer),
      };
    });

  return NextResponse.json({ benchmarks });
}

/** Approximates the percentile of `value` from the p25/p50/p75 quartiles. */
function estimatePercentile(value: number, peer: PeerStat): number {
  const minV = Number(peer.min_value);
  const p25 = Number(peer.p25);
  const p50 = Number(peer.p50);
  const p75 = Number(peer.p75);
  const maxV = Number(peer.max_value);
  if (value <= minV) return 0;
  if (value >= maxV) return 100;
  if (value <= p25) return interpolate(value, minV, p25, 0, 25);
  if (value <= p50) return interpolate(value, p25, p50, 25, 50);
  if (value <= p75) return interpolate(value, p50, p75, 50, 75);
  return interpolate(value, p75, maxV, 75, 100);
}

function interpolate(v: number, lo: number, hi: number, loP: number, hiP: number): number {
  if (hi === lo) return loP;
  return loP + ((v - lo) / (hi - lo)) * (hiP - loP);
}
