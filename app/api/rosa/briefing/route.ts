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
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  expandDeadlinesForOrg,
  COMPLIANCE_DEADLINES,
  type DeadlineApplicabilityFlags,
} from '@/lib/pulse/regulatory-deadlines';

export const runtime = 'nodejs';
// No revalidate — responses depend on the auth-resolved org which the
// segment-level cache can't distinguish. Per-user / per-org dedup happens
// at the route level if needed.
export const dynamic = 'force-dynamic';

interface BriefingResponse {
  insight: { headline: string; generated_at: string } | null;
  anomalies: { open_count: number; top_severity: 'low' | 'medium' | 'high' | null };
  next_deadline: {
    title: string;
    regime_label: string;
    why_it_matters: string;
    due_date: string;
    days_away: number;
    action_href: string;
  } | null;
  /** Forward-looking deadline used for the "no urgent items" anticipate
      tile. Same shape as next_deadline but filtered to >14 days out. */
  next_anticipated: {
    title: string;
    regime_label: string;
    why_it_matters: string;
    due_date: string;
    days_away: number;
    action_href: string;
  } | null;
  next_gap: { step: string; why: string; href: string } | null;
}

export async function GET() {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  // Pulse is GA for every tier, so all orgs get the insight/anomaly tiles (the
  // snapshot/anomaly crons run for every org). We still read feature_flags for
  // the regulatory-regime applicability flags below, so we don't fire
  // ETS / CBAM / CSRD / SECR deadlines at non-applicable orgs.
  const { data: orgRow } = await service
    .from('organizations')
    .select('feature_flags')
    .eq('id', organizationId)
    .maybeSingle();
  const flags = ((orgRow as any)?.feature_flags ?? {}) as Record<string, unknown>;
  const pulseEnabled = true;
  const deadlineFlags: DeadlineApplicabilityFlags = {
    uk_ets_operator: flags.uk_ets_operator === true,
    cbam_imports: flags.cbam_imports === true,
    csrd_in_scope: flags.csrd_in_scope === true,
    secr_in_scope: flags.secr_in_scope === true,
  };

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
      .select('id, product_id, product_name, status, updated_at')
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

  // Next deadline in the next 12 months — filtered by what actually applies
  // to this org. Drinks producers see EPR + Plastic Tax by default; ETS,
  // CBAM, CSRD, SECR only when the org has explicitly opted in.
  const upcoming = expandDeadlinesForOrg(COMPLIANCE_DEADLINES, deadlineFlags, 12, new Date());
  const sorted = [...upcoming].sort((a, b) => a.days_away - b.days_away);
  const nextDeadline = sorted.find(d => d.days_away >= -30);
  // Anticipate tile picks the next forward-looking deadline that's far enough
  // out to be informational rather than urgent.
  const nextAnticipated = sorted.find(d => d.days_away > 14);

  // Next data gap
  const p = productsCount.count ?? 0;
  const f = facilitiesCount.count ?? 0;
  const s = suppliersCount.count ?? 0;
  const lc = completedLcasCount.count ?? 0;
  let nextGap: BriefingResponse['next_gap'];
  if (p === 0) {
    nextGap = {
      step: 'Add your first product',
      why: 'Rosa needs a product to calculate anything against.',
      href: '/products/new/',
    };
  } else if (f === 0) {
    nextGap = {
      step: 'Add a facility',
      why: 'Footprints need to know where production happens.',
      href: '/company/facilities/?addFacility=1',
    };
  } else if (s === 0) {
    nextGap = {
      step: 'Add a supplier',
      why: 'Scope 3, the biggest chunk of a drinks footprint, needs supplier data.',
      href: '/suppliers/new/',
    };
  } else if (lc === 0) {
    nextGap = {
      step: 'Complete your first LCA',
      why: 'An LCA unlocks benchmarks, hotspots and reports.',
      href: '/products/',
    };
  } else if (draftLca.data && draftLca.data.length > 0) {
    const draft = draftLca.data[0] as any;
    // Deep-link straight into the compliance wizard for THIS product so
    // the user lands exactly where the work happens, not on the index.
    const productId = draft.product_id as string | undefined;
    nextGap = {
      step: `Finish the LCA for ${draft.product_name}`,
      why: 'Draft or in-progress LCAs block compliance claims.',
      href: productId ? `/products/${productId}/compliance-wizard/` : '/products/',
    };
  } else {
    nextGap = {
      step: 'Set a reduction target',
      why: 'You have a baseline. Next lever is committing to a target.',
      href: '/pulse/targets/',
    };
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
          why_it_matters: nextDeadline.why_it_matters,
          due_date: nextDeadline.due_date,
          days_away: nextDeadline.days_away,
          action_href: nextDeadline.action_href,
        }
      : null,
    next_anticipated: nextAnticipated
      ? {
          title: nextAnticipated.title,
          regime_label: nextAnticipated.regime_label,
          why_it_matters: nextAnticipated.why_it_matters,
          due_date: nextAnticipated.due_date,
          days_away: nextAnticipated.days_away,
          action_href: nextAnticipated.action_href,
        }
      : null,
    next_gap: nextGap,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
