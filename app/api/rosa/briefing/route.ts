/**
 * Rosa — briefing aggregator.
 *
 * GET /api/rosa/briefing
 * Returns the four tiles shown above the /rosa chat:
 *   1. Latest daily insight (from dashboard_insights)
 *   2. Open anomalies summary (from dashboard_anomalies)
 *   3. Next regulatory deadline (from lib/pulse/regulatory-deadlines)
 *   4. Biggest data gap (same logic as the suggest_data_gaps tool)
 *
 * Cached 5 minutes per (org, user) via HTTP Cache-Control because the
 * underlying data only changes once a day.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { expandDeadlines, COMPLIANCE_DEADLINES } from '@/lib/pulse/regulatory-deadlines';

export const runtime = 'nodejs';
export const revalidate = 300;

interface BriefingResponse {
  insight: { headline: string; generated_at: string } | null;
  anomalies: { open_count: number; top_severity: 'low' | 'medium' | 'high' | null };
  next_deadline: { title: string; regime_label: string; due_date: string; days_away: number; action_href: string } | null;
  next_gap: { step: string; why: string; href: string } | null;
}

export async function GET() {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'No organisation membership' }, { status: 403 });
  }
  const organizationId = (membership as any).organization_id as string;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Only orgs with the pulse_beta flag get insight/anomaly tiles — they read
  // from Pulse-only tables that shouldn't leak into the UI for non-Pulse orgs.
  const { data: orgRow } = await service
    .from('organizations')
    .select('feature_flags')
    .eq('id', organizationId)
    .maybeSingle();
  const pulseEnabled = Boolean(
    (orgRow as any)?.feature_flags?.pulse_beta === true,
  );

  const [
    insightRes,
    anomaliesRes,
    productsCount,
    facilitiesCount,
    suppliersCount,
    completedLcasCount,
    draftLca,
  ] = await Promise.all([
    pulseEnabled
      ? service
          .from('dashboard_insights')
          .select('headline, generated_at')
          .eq('organization_id', organizationId)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    pulseEnabled
      ? service
          .from('dashboard_anomalies')
          .select('severity, status')
          .eq('organization_id', organizationId)
          .gte('detected_at', new Date(Date.now() - 14 * 86400_000).toISOString())
      : Promise.resolve({ data: [], error: null } as any),
    service.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('facilities').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service.from('suppliers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    service
      .from('product_carbon_footprints')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'completed'),
    service
      .from('product_carbon_footprints')
      .select('id, product_name, status, updated_at')
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'in_progress'])
      .order('updated_at', { ascending: true })
      .limit(1),
  ]);

  // Anomalies summary
  type Severity = 'low' | 'medium' | 'high';
  const anomalyRows: Array<{ severity?: string | null; status?: string | null }> =
    Array.isArray((anomaliesRes as any).data) ? (anomaliesRes as any).data : [];
  const openAnomalies = anomalyRows.filter(r => r.status !== 'resolved');
  const severityOrder: Record<Severity, number> = { low: 0, medium: 1, high: 2 };
  const topSev: Severity | null = openAnomalies.reduce<Severity | null>((acc, r) => {
    const sev = (r.severity as Severity | null | undefined) ?? null;
    if (!sev) return acc;
    if (!acc) return sev;
    return severityOrder[sev] > severityOrder[acc] ? sev : acc;
  }, null);

  // Next deadline in the next 12 months
  const upcoming = expandDeadlines(COMPLIANCE_DEADLINES, 12, new Date());
  const nextDeadline = upcoming
    .filter(d => d.days_away >= -30)
    .sort((a, b) => a.days_away - b.days_away)[0];

  // Next data gap
  const p = productsCount.count ?? 0;
  const f = facilitiesCount.count ?? 0;
  const s = suppliersCount.count ?? 0;
  const lc = completedLcasCount.count ?? 0;
  let nextGap: BriefingResponse['next_gap'];
  if (p === 0) {
    nextGap = { step: 'Add your first product', why: 'Rosa needs a product to calculate anything against.', href: '/products' };
  } else if (f === 0) {
    nextGap = { step: 'Add a facility', why: 'Footprints need to know where production happens.', href: '/company/facilities' };
  } else if (s === 0) {
    nextGap = { step: 'Add a supplier', why: 'Scope 3, the biggest chunk of a drinks footprint, needs supplier data.', href: '/suppliers' };
  } else if (lc === 0) {
    nextGap = { step: 'Complete your first LCA', why: 'An LCA unlocks benchmarks, hotspots and reports.', href: '/products' };
  } else if (draftLca.data && draftLca.data.length > 0) {
    nextGap = {
      step: `Finish the LCA for ${(draftLca.data[0] as any).product_name}`,
      why: 'Draft or in-progress LCAs block compliance claims.',
      href: '/products',
    };
  } else {
    nextGap = { step: 'Set a reduction target', why: 'You have a baseline. Next lever is committing to a target.', href: '/performance' };
  }

  const payload: BriefingResponse = {
    insight: insightRes.data
      ? { headline: (insightRes.data as any).headline, generated_at: (insightRes.data as any).generated_at }
      : null,
    anomalies: { open_count: openAnomalies.length, top_severity: topSev },
    next_deadline: nextDeadline
      ? {
          title: nextDeadline.title,
          regime_label: nextDeadline.regime_label,
          due_date: nextDeadline.due_date,
          days_away: nextDeadline.days_away,
          action_href: nextDeadline.action_href,
        }
      : null,
    next_gap: nextGap,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=300',
    },
  });
}
