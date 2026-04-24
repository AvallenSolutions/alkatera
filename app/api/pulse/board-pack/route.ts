/**
 * Pulse -- Board-pack PDF export (F9).
 *
 * POST /api/pulse/board-pack?organization_id=...
 *
 * Composes the financial summary from every existing Pulse API, renders it
 * into a two-page landscape HTML via lib/pulse/board-pack-template.ts, and
 * converts to PDF via PDFShift. Returns application/pdf so the browser
 * downloads it.
 *
 * One-click export from the Financial page. Zero new data -- purely a
 * composition of F1/F2/F4/F8/F3/F5.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadShadowPrices } from '@/lib/pulse/shadow-prices';
import {
  ABATEMENT_LEVERS,
  levelisedAbatementCost,
  simplePayback,
} from '@/lib/pulse/abatement-costs';
import { calculateRegulatoryExposure } from '@/lib/pulse/regulatory-exposure';
import { renderBoardPackHtml, type BoardPackInput } from '@/lib/pulse/board-pack-template';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CATEGORY_LABELS: Record<string, string> = {
  utility_electricity: 'Electricity',
  utility_gas: 'Natural gas',
  utility_fuel: 'Fuels',
  utility_other: 'Other utilities',
  waste_general: 'General waste',
  waste_hazardous: 'Hazardous waste',
  water_intake: 'Water intake',
};

export async function POST(request: NextRequest) {
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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Organisation name for the cover.
    const { data: org } = await svc
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    const orgName = org?.name ?? 'Your organisation';

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 365);
    const priorStart = new Date(start);
    priorStart.setDate(priorStart.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Resolved shadow prices (needed by multiple sections).
    const prices = await loadShadowPrices(svc, organizationId);
    const carbonPricePerT = prices.total_co2e?.price_per_unit ?? 85;
    const carbonMultiplier = (prices.total_co2e?.native_unit_multiplier ?? 0.001) * carbonPricePerT;
    const waterMultiplier = prices.water_consumption
      ? prices.water_consumption.native_unit_multiplier * prices.water_consumption.price_per_unit
      : 0;

    // 1. Trailing + prior 12m cost from metric_snapshots (for the hero).
    const { data: snapshots } = await svc
      .from('metric_snapshots')
      .select('metric_key, snapshot_date, value')
      .eq('organization_id', organizationId)
      .in('metric_key', ['total_co2e', 'water_consumption'])
      .gte('snapshot_date', fmt(priorStart))
      .lte('snapshot_date', fmt(today));

    let trailing = 0;
    let prior = 0;
    const byMetric: Record<string, number> = {};
    for (const row of snapshots ?? []) {
      const m =
        row.metric_key === 'total_co2e'
          ? carbonMultiplier
          : row.metric_key === 'water_consumption'
            ? waterMultiplier
            : 0;
      const gbp = Number(row.value ?? 0) * m;
      const date = row.snapshot_date as string;
      if (date >= fmt(start)) {
        trailing += gbp;
        byMetric[row.metric_key as string] = (byMetric[row.metric_key as string] ?? 0) + gbp;
      } else {
        prior += gbp;
      }
    }
    const totalTrailing = trailing || 1;

    // 2. Intensity ratios.
    const [revenueRes, fteRes, unitsRes] = await Promise.all([
      svc.from('epr_organization_settings').select('annual_turnover_gbp').eq('organization_id', organizationId).maybeSingle(),
      svc.from('community_local_impact').select('total_employees').eq('organization_id', organizationId).order('reporting_year', { ascending: false }).limit(1).maybeSingle(),
      svc.from('facility_emissions_aggregated').select('units_produced').eq('organization_id', organizationId).gte('reporting_year', today.getFullYear() - 1),
    ]);
    const revenue = Number(revenueRes.data?.annual_turnover_gbp ?? 0);
    const fte = Number(fteRes.data?.total_employees ?? 0);
    const units = (unitsRes.data ?? []).reduce((s, r: any) => s + Number(r.units_produced ?? 0), 0);

    // 3. Top cost drivers.
    const { data: entries } = await svc
      .from('facility_activity_entries')
      .select('facility_id, activity_category, calculated_emissions_kg_co2e, quantity')
      .eq('organization_id', organizationId)
      .gte('activity_date', fmt(start))
      .lt('activity_date', fmt(today));
    const { data: facilities } = await svc
      .from('facilities')
      .select('id, name')
      .eq('organization_id', organizationId);
    const facilityName = new Map<string, string>();
    for (const f of facilities ?? []) facilityName.set(f.id, f.name as string);

    const lineItemMap = new Map<string, { label: string; gbp: number }>();
    let driverTotal = 0;
    for (const row of (entries ?? []) as any[]) {
      const cat = row.activity_category as string;
      const isWater = cat?.startsWith('water');
      const v = Number(isWater ? row.quantity : row.calculated_emissions_kg_co2e) || 0;
      const gbp = v * (isWater ? waterMultiplier : carbonMultiplier);
      if (gbp <= 0) continue;
      const fid = row.facility_id as string | null;
      const label = `${CATEGORY_LABELS[cat] ?? cat} · ${fid ? facilityName.get(fid) ?? 'Unknown facility' : 'Org-wide'}`;
      const existing = lineItemMap.get(label);
      if (existing) existing.gbp += gbp;
      else lineItemMap.set(label, { label, gbp });
      driverTotal += gbp;
    }
    const topLineItems = Array.from(lineItemMap.values())
      .sort((a, b) => b.gbp - a.gbp)
      .slice(0, 10)
      .map((l, i) => ({
        rank: i + 1,
        label: l.label,
        gbp: l.gbp,
        pct: driverTotal > 0 ? (l.gbp / driverTotal) * 100 : 0,
      }));

    // 4. Annual emissions (tonnes) for MACC + scenario + regulatory.
    const annualKg = (snapshots ?? [])
      .filter(r => r.metric_key === 'total_co2e' && (r.snapshot_date as string) >= fmt(start))
      .reduce((s, r) => s + Number(r.value ?? 0), 0);
    const annualTonnes = annualKg / 1000;

    // 5. MACC top 5 for the pack.
    const categoryTonnes = new Map<string, number>();
    for (const row of (entries ?? []) as any[]) {
      const t = Number(row.calculated_emissions_kg_co2e ?? 0) / 1000;
      const cat = row.activity_category as string;
      if (Number.isFinite(t) && t > 0) {
        categoryTonnes.set(cat, (categoryTonnes.get(cat) ?? 0) + t);
      }
    }
    const facilityCount = Math.max(1, (facilities ?? []).length);
    const maccLevers = ABATEMENT_LEVERS.map(lever => {
      const affected = lever.categories.reduce((s, c) => s + (categoryTonnes.get(c) ?? 0), 0);
      const tonnes = affected * lever.maxReductionFactor;
      const capex =
        lever.capexBasis === 'per_facility'
          ? lever.capexGbp * facilityCount
          : lever.capexBasis === 'per_tonne_abated_per_year'
            ? lever.capexGbp * tonnes
            : 0;
      const annualSaving = tonnes * lever.avgUtilityCostGbpPerTonne * lever.utilityBillSavingFactor;
      const levelised = levelisedAbatementCost({
        capex,
        lifetimeYears: lever.lifetimeYears,
        discountRate: 0.08,
        annualUtilitySavingGbp: annualSaving,
        annualTonnesAbated: tonnes,
      });
      return {
        label: lever.label,
        tonnes,
        gbp_per_tonne: levelised,
        payback_years: simplePayback(capex, annualSaving + tonnes * carbonPricePerT),
      };
    })
      .filter(l => l.tonnes > 0)
      .sort((a, b) => a.gbp_per_tonne - b.gbp_per_tonne);

    // 6. Regulatory exposure.
    const regulatory = calculateRegulatoryExposure({
      annual_tonnes_co2e: annualTonnes,
      uk_ets_free_allocation_t: 0,
      cbam_embedded_tonnes: 0,
      plastic_packaging_tonnes: 0,
      plastic_recycled_share: 0,
      packaging_by_material_t: {},
    });

    // 7. Carbon budgets (current-period variance).
    const { data: budgetRows } = await svc
      .from('carbon_budgets')
      .select('*')
      .eq('organization_id', organizationId);
    const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const yearSnapshots = (snapshots ?? []).filter(
      s => s.metric_key === 'total_co2e' && (s.snapshot_date as string) >= startOfYear,
    );
    const budgets = (budgetRows ?? []).map((b: any) => {
      const pStart =
        b.period === 'monthly'
          ? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
          : b.period === 'quarterly'
            ? new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1).toISOString().slice(0, 10)
            : startOfYear;
      const actualT =
        yearSnapshots
          .filter(s => (s.snapshot_date as string) >= pStart)
          .reduce((s, row) => s + Number(row.value ?? 0), 0) / 1000;
      const variancePct = b.budget_tco2e > 0 ? ((actualT - b.budget_tco2e) / b.budget_tco2e) * 100 : 0;
      const status: 'on_track' | 'at_risk' | 'over' =
        variancePct <= 0 ? 'on_track' : variancePct <= 10 ? 'at_risk' : 'over';
      return {
        label: `${b.scope === 'all' ? 'All scopes' : b.scope.replace('_', ' ')} · ${b.period}`,
        budget_t: b.budget_tco2e,
        actual_t: actualT,
        variance_pct: variancePct,
        status,
      };
    });

    // Assemble template input.
    const input: BoardPackInput = {
      organizationName: orgName,
      generatedAt: today.toLocaleString('en-GB'),
      reportingWindow: `${fmt(start)} to ${fmt(today)}`,
      financialFootprint: {
        total_gbp: trailing,
        prior_gbp: prior,
        delta_gbp: trailing - prior,
        delta_pct: prior > 0 ? ((trailing - prior) / prior) * 100 : null,
        by_metric: Object.entries(byMetric)
          .map(([metric, gbp]) => ({
            label: metric === 'total_co2e' ? 'Carbon emissions' : metric === 'water_consumption' ? 'Water consumption' : metric,
            gbp,
            pct: (gbp / totalTrailing) * 100,
          }))
          .sort((a, b) => b.gbp - a.gbp),
      },
      intensity: {
        per_m_revenue: revenue > 0 ? trailing / (revenue / 1_000_000) : null,
        per_fte: fte > 0 ? trailing / fte : null,
        per_unit: units > 0 ? trailing / units : null,
      },
      scenarioSensitivity: {
        annual_tonnes: annualTonnes,
        current_gbp_per_t: carbonPricePerT,
        sensitivity_gbp_per_10: annualTonnes * 10,
        stress_gbp: annualTonnes * 250,
      },
      topLineItems,
      maccTop: maccLevers.slice(0, 5),
      regulatory: {
        total_gbp: regulatory.total_annual_gbp,
        lines: regulatory.lines.map(l => ({
          label: l.label,
          gbp: l.annual_cost_gbp,
          basis: l.basis,
        })),
      },
      budgets,
    };

    const html = renderBoardPackHtml(input);
    const pdf = await convertHtmlToPdf(html, { landscape: true, format: 'A4' });

    return new Response(pdf.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pulse-board-pack-${fmt(today)}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[pulse board-pack]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
