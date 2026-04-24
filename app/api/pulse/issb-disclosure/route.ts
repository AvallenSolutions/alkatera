/**
 * Pulse -- ISSB / IFRS S2 disclosure (F10).
 *
 * GET  /api/pulse/issb-disclosure?organization_id=...           -> JSON disclosure
 * GET  /api/pulse/issb-disclosure?organization_id=...&format=csv -> CSV download
 *
 * Composes the quantitative sections of an IFRS S2 disclosure from live Pulse
 * data (Scope 1+2 emissions, intensity, liability, scenario analysis, targets,
 * regulatory exposure). Returns narrative stubs for governance, risk
 * management and transition plan (filled with the org's own numbers so the
 * editing job is minimal).
 *
 * Output formats:
 *   - JSON (default)  : the UI renders a disclosure preview
 *   - CSV (?format=csv): direct download for pasting into the annual report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import { calculateRegulatoryExposure } from '@/lib/pulse/regulatory-exposure';
import { buildIssbDisclosure } from '@/lib/pulse/issb-disclosure';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    let organizationId = orgIdParam;
    if (!organizationId) {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      organizationId = m?.organization_id ?? null;
    } else {
      const { data: m } = await userSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 400 });
    }

    const format = request.nextUrl.searchParams.get('format') ?? 'json';

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const priorStart = new Date(start);
    priorStart.setDate(priorStart.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Org name.
    const { data: org } = await svc
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const orgName = org?.name ?? 'Your organisation';

    // Current + prior Scope 1+2 in tonnes.
    const { data: snaps } = await svc
      .from('metric_snapshots')
      .select('snapshot_date, value')
      .eq('organization_id', organizationId)
      .eq('metric_key', 'total_co2e')
      .gte('snapshot_date', fmt(priorStart))
      .lte('snapshot_date', fmt(today));

    let currentKg = 0;
    let priorKg = 0;
    for (const row of snaps ?? []) {
      const date = row.snapshot_date as string;
      const v = Number(row.value ?? 0);
      if (!Number.isFinite(v)) continue;
      if (date >= fmt(start)) currentKg += v;
      else priorKg += v;
    }
    const currentTonnes = currentKg / 1000;
    const priorTonnes = priorKg / 1000;

    // Revenue, units.
    const [revenueRes, unitsRes] = await Promise.all([
      svc
        .from('epr_organization_settings')
        .select('annual_turnover_gbp')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      svc
        .from('facility_emissions_aggregated')
        .select('units_produced')
        .eq('organization_id', organizationId)
        .gte('reporting_year', today.getFullYear() - 1),
    ]);
    const annualRevenueGbp = Number(revenueRes.data?.annual_turnover_gbp ?? 0);
    const unitsProduced = (unitsRes.data ?? []).reduce(
      (s, r: any) => s + Number(r.units_produced ?? 0),
      0,
    );

    // Shadow price.
    const prices = await loadShadowPrices(svc, organizationId);
    const carbonPricePerT = prices.total_co2e?.price_per_unit ?? 85;
    const currentLiabilityGbp = currentTonnes * carbonPricePerT;
    const sensitivityGbpPer10 = currentTonnes * 10;

    // Targets.
    const { data: targetRows } = await svc
      .from('sustainability_targets')
      .select('metric_key, baseline_value, baseline_date, target_value, target_date, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active');
    const targets = (targetRows ?? []).map((t: any) => ({
      metric_key: String(t.metric_key),
      baseline_value: Number(t.baseline_value),
      baseline_date: String(t.baseline_date),
      target_value: Number(t.target_value),
      target_date: String(t.target_date),
      unit: 'tCO2e',
      status: String(t.status),
    }));

    // Regulatory exposure total.
    const reg = calculateRegulatoryExposure({
      annual_tonnes_co2e: currentTonnes,
      uk_ets_free_allocation_t: 0,
      cbam_embedded_tonnes: 0,
      plastic_packaging_tonnes: 0,
      plastic_recycled_share: 0,
      packaging_by_material_t: {},
    });

    const disclosure = buildIssbDisclosure({
      organizationName: orgName,
      reportingPeriodStart: fmt(start),
      reportingPeriodEnd: fmt(today),
      currentScope12Tonnes: currentTonnes,
      priorScope12Tonnes: priorTonnes,
      annualRevenueGbp,
      unitsProduced,
      carbonPriceGbpPerTonne: carbonPricePerT,
      currentLiabilityGbp,
      sensitivityGbpPer10,
      targets,
      regulatoryExposureGbp: reg.total_annual_gbp,
    });

    if (format === 'csv') {
      return new Response(disclosure.csvExport, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="issb-disclosure-${fmt(today)}.csv"`,
        },
      });
    }

    return NextResponse.json({ ok: true, disclosure });
  } catch (err: any) {
    console.error('[pulse issb-disclosure]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
