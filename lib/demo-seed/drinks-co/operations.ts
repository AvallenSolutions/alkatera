import {
  FACILITIES,
  HISTORY_MONTHS,
  PRODUCTS,
  monthEnd,
  monthStart,
  trendFactor,
  type SeedCtx,
} from './shared';

/**
 * Operational history: ~24 months of energy, water, waste and production for
 * each owned facility, trending gently down to tell an improvement story, plus
 * the reconciled metric / ESG / vitality time-series the Pulse trends read.
 *
 * Energy lands in BOTH utility_data_entries (Scope 1&2 page + company footprint
 * read this) and facility_activity_entries (Pulse snapshots + water dashboard
 * read this); the calculator's source-priority layer dedupes them.
 */

interface FacilityProfile {
  id: string;
  /** Baseline monthly figures at the oldest month (before the downward trend). */
  electricityKwh: number;
  gasKwh: number;
  dieselLitres: number;
  refrigerantKg: number; // annual; spread per month
  waterM3: number;
  wasteKg: number;
}

const PROFILES: FacilityProfile[] = [
  { id: FACILITIES.winery, electricityKwh: 9000, gasKwh: 3000, dieselLitres: 120, refrigerantKg: 6, waterM3: 220, wasteKg: 800 },
  { id: FACILITIES.distillery, electricityKwh: 26000, gasKwh: 48000, dieselLitres: 60, refrigerantKg: 12, waterM3: 600, wasteKg: 1500 },
  { id: FACILITIES.brewery, electricityKwh: 38000, gasKwh: 30000, dieselLitres: 90, refrigerantKg: 18, waterM3: 1800, wasteKg: 2600 },
  { id: FACILITIES.headOffice, electricityKwh: 3500, gasKwh: 1200, dieselLitres: 0, refrigerantKg: 4, waterM3: 60, wasteKg: 300 },
];

// Emission factors used only to build a coherent total_co2e snapshot series.
const EF_ELEC = 0.207; // kg CO2e / kWh (UK grid)
const EF_GAS = 0.184;
const EF_DIESEL = 2.51; // kg / litre
const GWP_REFRIGERANT = 1430; // R134a

/** Which products each owned facility produces (for production_logs). */
const FACILITY_PRODUCTS: Record<string, number[]> = {
  [FACILITIES.winery]: [PRODUCTS.bacchus],
  [FACILITIES.distillery]: [PRODUCTS.highlandMalt, PRODUCTS.bathGin, PRODUCTS.calvadosGlass, PRODUCTS.calvadosPaper],
  [FACILITIES.brewery]: [PRODUCTS.sessionAle, PRODUCTS.ipaCan],
};

async function seedActivity(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  const utilityRows: Record<string, unknown>[] = [];
  const activityRows: Record<string, unknown>[] = [];
  // monthly scope 1+2 kg CO2e per month-index for the snapshot series
  const monthlyScope12 = new Array(HISTORY_MONTHS).fill(0);
  const monthlyWater = new Array(HISTORY_MONTHS).fill(0);

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const monthsAgo = HISTORY_MONTHS - 1 - i; // i=0 oldest
    const start = monthStart(monthsAgo);
    const end = monthEnd(monthsAgo);
    const f = trendFactor(i, HISTORY_MONTHS);

    for (const p of PROFILES) {
      const elec = Math.round(p.electricityKwh * f);
      const gas = Math.round(p.gasKwh * f);
      const diesel = Math.round(p.dieselLitres * f);
      const refrig = +(p.refrigerantKg / 12 * f).toFixed(3);
      const water = Math.round(p.waterM3 * f);
      const waste = Math.round(p.wasteKg * f);

      // --- utility_data_entries (energy; Scope 1&2 + footprint) ---
      utilityRows.push(
        { facility_id: p.id, utility_type: 'electricity_grid', quantity: elec, unit: 'kWh', reporting_period_start: start, reporting_period_end: end, data_quality: 'actual' },
        { facility_id: p.id, utility_type: 'natural_gas', quantity: gas, unit: 'kWh', reporting_period_start: start, reporting_period_end: end, data_quality: 'actual' },
      );
      if (diesel > 0) utilityRows.push({ facility_id: p.id, utility_type: 'diesel_stationary', quantity: diesel, unit: 'litres', reporting_period_start: start, reporting_period_end: end, data_quality: 'actual' });
      if (refrig > 0) utilityRows.push({ facility_id: p.id, utility_type: 'refrigerant_leakage', quantity: refrig, unit: 'kg', reporting_period_start: start, reporting_period_end: end, data_quality: 'estimated' });

      // --- facility_activity_entries (Pulse snapshots + water/waste dashboards) ---
      const base = { facility_id: p.id, organization_id: orgId, activity_date: end, reporting_period_start: start, reporting_period_end: end, data_provenance: 'primary_measured_onsite' as const };
      activityRows.push(
        { ...base, activity_category: 'utility_electricity', quantity: elec, unit: 'kWh' },
        { ...base, activity_category: 'utility_gas', quantity: gas, unit: 'kWh' },
        { ...base, activity_category: 'water_intake', quantity: water, unit: 'm3', water_source_type: 'municipal', water_classification: 'blue' },
        { ...base, activity_category: 'water_discharge', quantity: Math.round(water * 0.7), unit: 'm3', wastewater_treatment_method: 'secondary_treatment' },
        { ...base, activity_category: 'water_recycled', quantity: Math.round(water * 0.12), unit: 'm3' },
        { ...base, activity_category: 'waste_general', quantity: Math.round(waste * 0.35), unit: 'kg', waste_category: 'process_waste', waste_treatment_method: 'landfill' },
        { ...base, activity_category: 'waste_recycling', quantity: Math.round(waste * 0.6), unit: 'kg', waste_category: 'packaging_waste', waste_treatment_method: 'recycling' },
        { ...base, activity_category: 'waste_hazardous', quantity: Math.round(waste * 0.05), unit: 'kg', waste_category: 'hazardous', waste_treatment_method: 'incineration_with_recovery', hazard_classification: 'hazardous' },
      );

      monthlyScope12[i] += elec * EF_ELEC + gas * EF_GAS + diesel * EF_DIESEL + refrig * GWP_REFRIGERANT;
      monthlyWater[i] += water;
    }
  }

  const ownedIds = PROFILES.map((p) => p.id);
  await svc.from('utility_data_entries').delete().in('facility_id', ownedIds);
  const { error: uErr } = await svc.from('utility_data_entries').insert(utilityRows);
  if (uErr) throw new Error(`utility_data_entries: ${uErr.message}`);

  await svc.from('facility_activity_entries').delete().eq('organization_id', orgId);
  const { error: aErr } = await svc.from('facility_activity_entries').insert(activityRows);
  if (aErr) throw new Error(`facility_activity_entries: ${aErr.message}`);

  ctx.report.activity = `${utilityRows.length} utility + ${activityRows.length} activity rows across ${HISTORY_MONTHS} months`;

  // stash for the snapshot series
  (ctx as any)._monthlyScope12 = monthlyScope12;
  (ctx as any)._monthlyWater = monthlyWater;
}

async function seedProduction(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const rows: Record<string, unknown>[] = [];
  // rough annual bottle output per product, split monthly and trended
  const annual: Record<number, number> = {
    [PRODUCTS.bacchus]: 28000, [PRODUCTS.highlandMalt]: 42000, [PRODUCTS.bathGin]: 36000,
    [PRODUCTS.calvadosGlass]: 12000, [PRODUCTS.calvadosPaper]: 6000,
    [PRODUCTS.sessionAle]: 320000, [PRODUCTS.ipaCan]: 480000,
  };
  const sizeLitres: Record<number, number> = {
    [PRODUCTS.bacchus]: 0.75, [PRODUCTS.highlandMalt]: 0.7, [PRODUCTS.bathGin]: 0.7,
    [PRODUCTS.calvadosGlass]: 0.7, [PRODUCTS.calvadosPaper]: 0.7,
    [PRODUCTS.sessionAle]: 0.33, [PRODUCTS.ipaCan]: 0.33,
  };

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const monthsAgo = HISTORY_MONTHS - 1 - i;
    const date = monthEnd(monthsAgo);
    // production grows slightly over time (inverse of the emissions trend)
    const growth = 0.85 + 0.15 * (i / Math.max(1, HISTORY_MONTHS - 1));
    for (const [facId, productIds] of Object.entries(FACILITY_PRODUCTS)) {
      for (const pid of productIds) {
        const units = Math.round((annual[pid] / 12) * growth);
        rows.push({
          organization_id: orgId,
          facility_id: facId,
          product_id: pid,
          date,
          volume: +(units * sizeLitres[pid]).toFixed(2),
          unit: 'Litre',
          units_produced: units,
        });
      }
    }
  }
  await svc.from('production_logs').delete().eq('organization_id', orgId);
  const { error } = await svc.from('production_logs').insert(rows);
  if (error) throw new Error(`production_logs: ${error.message}`);
  ctx.report.production = `${rows.length} production_log rows`;
}

async function seedSnapshots(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const monthlyScope12: number[] = (ctx as any)._monthlyScope12 ?? [];
  const monthlyWater: number[] = (ctx as any)._monthlyWater ?? [];

  const metricRows: Record<string, unknown>[] = [];
  const esgRows: Record<string, unknown>[] = [];
  const vitalityRows: Record<string, unknown>[] = [];

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const monthsAgo = HISTORY_MONTHS - 1 - i;
    const date = monthEnd(monthsAgo);
    const progress = i / Math.max(1, HISTORY_MONTHS - 1);

    // Annualised run-rate (this month × 12) so the trend declines cleanly rather
    // than ramping while a trailing window fills.
    const co2eAnnual = monthlyScope12[i] * 12;
    const waterAnnual = monthlyWater[i] * 12;
    const productsAssessed = Math.min(9, Math.round(1 + progress * 8));
    const completeness = Math.round(10 + progress * 80);

    metricRows.push(
      { organization_id: orgId, metric_key: 'total_co2e', snapshot_date: date, value: Math.round(co2eAnnual), unit: 'kg CO2e', dimensions: {} },
      { organization_id: orgId, metric_key: 'water_consumption', snapshot_date: date, value: Math.round(waterAnnual), unit: 'm3', dimensions: {} },
      { organization_id: orgId, metric_key: 'products_assessed', snapshot_date: date, value: productsAssessed, unit: 'products', dimensions: {} },
      { organization_id: orgId, metric_key: 'lca_completeness_pct', snapshot_date: date, value: completeness, unit: '%', dimensions: {} },
    );

    // ESG composite trends up 58 -> 80
    const env = +(56 + progress * 26).toFixed(1);
    const soc = +(62 + progress * 20).toFixed(1);
    const gov = +(64 + progress * 18).toFixed(1);
    const composite = +((env + soc + gov) / 3).toFixed(1);
    esgRows.push({
      organization_id: orgId, snapshot_date: date, composite, environmental: env, social: soc, governance: gov,
      breakdown: { e: { climate: env, water: env - 4, circularity: env - 8 }, s: { workforce: soc, community: soc - 6 }, g: { governance: gov } },
      weights: { v: 1, e: 0.5, s: 0.25, g: 0.25 },
    });

    vitalityRows.push({
      organization_id: orgId, snapshot_date: date,
      overall_score: Math.round(composite), climate_score: Math.round(env),
      water_score: Math.round(env - 4), circularity_score: Math.round(env - 8), nature_score: Math.round(env - 2),
    });
  }

  // Clear any pre-existing (often erratic, daily) snapshots first so the trend
  // is the clean monthly series we seed — mixing the two makes the chart jagged.
  const managedKeys = ['total_co2e', 'water_consumption', 'products_assessed', 'lca_completeness_pct'];
  await svc.from('metric_snapshots').delete().eq('organization_id', orgId).in('metric_key', managedKeys);
  await svc.from('metric_snapshots').insert(metricRows);
  await svc.from('esg_score_snapshots').delete().eq('organization_id', orgId);
  await svc.from('esg_score_snapshots').insert(esgRows);
  await svc.from('vitality_score_snapshots').delete().eq('organization_id', orgId);
  await svc.from('vitality_score_snapshots').insert(vitalityRows);

  // a current full vitality record for the headline tiles
  const last = vitalityRows[vitalityRows.length - 1] as any;
  await svc.from('organization_vitality_scores').delete().eq('organization_id', orgId);
  await svc.from('organization_vitality_scores').insert({
    organization_id: orgId, year: 2026, overall_score: last.overall_score, climate_score: last.climate_score,
    water_score: last.water_score, circularity_score: last.circularity_score, nature_score: last.nature_score,
    products_assessed: 9,
  });

  // Replace any stale insight (e.g. an old "no data recorded yet" headline that
  // now contradicts the seeded data) with one that matches what we just wrote.
  //
  // This used to be a bare delete, on the reasoning that a fresh one would
  // regenerate. It does not regenerate on its own: it needs an LLM run, so the
  // first card on the Pulse overview sat blank on an otherwise fully-populated
  // org. `model` names the seed rather than a real model, so nobody mistakes
  // this for genuine analysis.
  // metricRows interleaves four metric keys per month and runs oldest first, so
  // filter to the one series before taking its endpoints.
  const totals = metricRows.filter((r: any) => r.metric_key === 'total_co2e');
  const firstTotal = Number((totals[0] as any)?.value ?? 0);
  const lastTotal = Number((totals[totals.length - 1] as any)?.value ?? 0);
  const changePct = firstTotal > 0 ? Math.round(((lastTotal - firstTotal) / firstTotal) * 100) : 0;
  const direction = changePct <= 0 ? 'down' : 'up';

  await svc.from('dashboard_insights').delete().eq('organization_id', orgId);
  const { error: insightErr } = await svc.from('dashboard_insights').insert({
    organization_id: orgId,
    period: 'monthly',
    headline: `Emissions are ${direction} ${Math.abs(changePct)}% across the last two years, with packaging still the largest driver.`,
    narrative_md: [
      `Total emissions have moved ${direction} by ${Math.abs(changePct)}% since the start of the reporting window, driven mostly by the electricity contract change at the distillery and steadily lighter glass.`,
      '',
      '**Where it still sits:** packaging remains the biggest single contributor across the product range. Glass is the reason, and the aluminium can line is measurably below the range average.',
      '',
      '**Worth a look:** the winery is the only owned site whose intensity has not improved this year. Its production volume fell faster than its energy use, so the per-litre figure went the wrong way.',
    ].join('\n'),
    supporting_metrics: {
      total_co2e_first: firstTotal,
      total_co2e_latest: lastTotal,
      change_pct: changePct,
      products_assessed: 9,
    },
    confidence: 0.8,
    model: 'alkatera-demo-seed',
  });
  if (insightErr) ctx.warnings.push(`dashboard insight: ${insightErr.message}`);

  ctx.report.snapshots = `${metricRows.length} metric + ${esgRows.length} ESG + ${vitalityRows.length} vitality snapshots + 1 Pulse insight`;
}

export async function seedOperations(ctx: SeedCtx): Promise<void> {
  await seedActivity(ctx);
  await seedProduction(ctx);
  await seedSnapshots(ctx);
}
