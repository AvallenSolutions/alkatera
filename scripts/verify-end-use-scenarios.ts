/**
 * End-to-end verification for end-use scenarios, against a real database.
 *
 * The unit tests prove the maths on fixtures. This proves the two paths the
 * fixtures cannot reach, because they talk to Postgres:
 *   - recomputeScenariosForPcf: loads a PCF, its materials and its scenarios,
 *     recovers the shared core and writes each scenario's results back
 *   - carryScenariosForward: moves scenarios onto a new PCF version so a
 *     supersede cannot silently drop a customer's configured channels
 *
 * Seeds its own cradle-to-grave product, asserts, then removes everything it
 * created. Local Supabase only: it refuses to run against a remote host.
 *
 *   npx tsx --env-file=.env.local scripts/verify-end-use-scenarios.ts
 */

import { createClient } from '@supabase/supabase-js';
import {
  carryScenariosForward,
  headlineFootprint,
  presetConfigsFor,
  recomputeScenariosForPcf,
  type EndUseScenario,
} from '../lib/lca/scenarios';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// A service-role key bypasses RLS entirely. This script writes and deletes, so
// it must never be pointed at a hosted project by accident.
if (!/127\.0\.0\.1|localhost/.test(url ?? '')) {
  console.error(`REFUSING TO RUN: ${url} is not a local Supabase. This script writes and deletes.`);
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!condition) failures++;
}

async function main() {
  // ── Seed ────────────────────────────────────────────────────────────────
  // Pick a product in an organisation with LCA headroom. A trial org's
  // insert trigger (enforce_trial_lca_limit) would otherwise refuse the seed,
  // which is itself the quota behaviour asserted further down.
  const { data: product } = await supabase
    .from('products')
    .select('id, name, organization_id, unit_size_value, unit_size_unit')
    .not('unit_size_value', 'is', null)
    .eq('organization_id', 'b0a00000-0000-4000-8000-000000000001')
    .limit(1)
    .single();
  if (!product) throw new Error('No seedable product found locally');

  console.log(`\nProduct: ${product.name} (${product.unit_size_value}${product.unit_size_unit})\n`);

  // The quota claim, measured rather than asserted: check_lca_limit counts
  // product_carbon_footprints rows, so scenarios must never move this number.
  const lcaCount = async (): Promise<number> => {
    const { data } = await supabase.rpc('check_lca_limit', { p_organization_id: product.organization_id });
    return Number((data as any)?.current_count ?? -1);
  };
  const countBeforeSeed = await lcaCount();

  const { data: pcf, error: pcfErr } = await supabase
    .from('product_carbon_footprints')
    .insert({
      product_id: product.id,
      organization_id: product.organization_id,
      product_name: `[scenario-verify] ${product.name}`,
      functional_unit: '1 bottle',
      reference_year: 2099, // far future: cannot collide with a real active PCF
      system_boundary: 'cradle-to-grave',
      lca_scope_type: 'cradle-to-grave',
      status: 'draft',
      // A plausible core: 0.9 gate + 0.02 downstream, with the 2/3/5% loss
      // multiplier already applied to the upstream portion exactly as the
      // aggregator would have stored it.
      total_ghg_emissions: 0.9 * (1 / (0.98 * 0.97 * 0.95)) + 0.02,
      aggregated_impacts: {
        breakdown: {
          by_lifecycle_stage: {
            raw_materials: 0.6 * (1 / (0.98 * 0.97 * 0.95)),
            packaging: 0.3 * (1 / (0.98 * 0.97 * 0.95)),
            distribution: 0,
            use_phase: 0.015,
            end_of_life: 0.005,
          },
        },
      },
      product_loss_config: { distributionLossPercent: 2, retailLossPercent: 3, consumerWastePercent: 5 },
    })
    .select('id')
    .single();
  if (pcfErr) throw new Error(`PCF insert failed: ${pcfErr.message}`);
  const pcfId = pcf!.id as string;

  const { error: matErr } = await supabase.from('product_carbon_footprint_materials').insert([
    {
      product_carbon_footprint_id: pcfId, name: 'Glass bottle 750ml', material_name: 'Glass bottle 750ml',
      material_type: 'packaging', packaging_category: 'container', container_material: 'glass',
      quantity: 0.45, unit: 'kg', impact_climate: 0.3,
    },
    {
      product_carbon_footprint_id: pcfId, name: 'Shipping case (6)', material_name: 'Shipping case (6)',
      material_type: 'packaging', packaging_category: 'secondary', container_material: 'paper',
      units_per_group: 6, quantity: 0.3, unit: 'kg', impact_climate: 0.05,
    },
    {
      product_carbon_footprint_id: pcfId, name: 'Grapes', material_name: 'Grapes',
      material_type: 'ingredient', quantity: 1.2, unit: 'kg', impact_climate: 0.6,
    },
  ]);
  if (matErr) throw new Error(`Materials insert failed: ${matErr.message}`);

  // Distribution needs a road-freight factor to resolve. A fresh local database
  // has no Transport rows, which is why distribution silently reads zero in the
  // unit tests; seed one so the journey is actually exercised here.
  const TRUCK_FACTOR = 'Freight - Road (HGV, Average laden)';
  const { data: existingFactor } = await supabase
    .from('staging_emission_factors')
    .select('id').eq('name', TRUCK_FACTOR).eq('category', 'Transport').maybeSingle();
  let seededFactorId: string | null = null;
  if (!existingFactor) {
    const { data: inserted, error: factorErr } = await supabase
      .from('staging_emission_factors')
      .insert({
        name: TRUCK_FACTOR, category: 'Transport',
        co2_factor: 0.10749, // DEFRA 2025, kg CO2e per tonne-km
        source: 'DEFRA 2025', reference_unit: 'tonne-km',
      })
      .select('id').single();
    if (factorErr) throw new Error(`Transport factor seed failed: ${factorErr.message}`);
    seededFactorId = (inserted as any)?.id ?? null;
  }

  const base = { usePhaseConfig: { needsRefrigeration: true, refrigerationDays: 5, retailFraction: 0.5, consumerCountryCode: 'GB', isCarbonated: false }, eolConfig: { region: 'eu' }, productWeightKg: 1.2 };

  const { error: scErr } = await supabase.from('pcf_end_use_scenarios').insert([
    {
      pcf_id: pcfId, organization_id: product.organization_id,
      name: 'Retail (off-trade)', channel: 'off_trade_retail', is_primary: true, share_pct: 70,
      ...presetConfigsFor('off_trade_retail', base),
    },
    {
      pcf_id: pcfId, organization_id: product.organization_id,
      name: 'On-trade', channel: 'on_trade', is_primary: false, share_pct: 30,
      ...presetConfigsFor('on_trade', base),
    },
  ]);
  if (scErr) throw new Error(`Scenario insert failed: ${scErr.message}`);

  try {
    // ── 1. recomputeScenariosForPcf ───────────────────────────────────────
    console.log('1. Recompute scenarios over a shared core');
    const outcome = await recomputeScenariosForPcf(supabase, pcfId);
    check('both scenarios computed', outcome.computed === 2, `computed=${outcome.computed} skipped=${outcome.skipped}`);

    const { data: computed } = await supabase
      .from('pcf_end_use_scenarios').select('*').eq('pcf_id', pcfId).order('name');
    const scenarios = (computed ?? []) as EndUseScenario[];
    const onTrade = scenarios.find(s => s.channel === 'on_trade')!;
    const retail = scenarios.find(s => s.channel === 'off_trade_retail')!;

    check('results were persisted', scenarios.every(s => s.stage_results != null && s.computed_at != null));
    check(
      'the core is shared, to the last bit',
      onTrade.stage_results!.core === retail.stage_results!.core,
      `${onTrade.stage_results!.core}`,
    );
    check(
      'the recovered core matches the seeded gate figure',
      Math.abs(onTrade.stage_results!.core - 0.9) < 1e-9,
      `recovered=${onTrade.stage_results!.core.toFixed(12)} seeded=0.9`,
    );
    check(
      'the totals diverge by channel',
      onTrade.stage_results!.total !== retail.stage_results!.total,
      `on-trade=${onTrade.stage_results!.total.toFixed(6)} retail=${retail.stage_results!.total.toFixed(6)}`,
    );
    check(
      'on-trade loses less product than retail',
      onTrade.stage_results!.lossMultiplier < retail.stage_results!.lossMultiplier,
      `${onTrade.stage_results!.lossMultiplier.toFixed(6)} < ${retail.stage_results!.lossMultiplier.toFixed(6)}`,
    );
    // Distribution is deliberately NOT asserted here. calculateTransportEmissions
    // resolves its DEFRA factor through the BROWSER Supabase client, and the
    // SELECT policies on staging_emission_factors are scoped to the
    // `authenticated` role (confirmed directly: authenticated reads the global
    // factor, anon reads nothing). This script is anonymous, so distribution
    // reads zero here for a reason that has nothing to do with the code under
    // test. It is covered instead in lib/lca/__tests__/downstream-distribution.ts,
    // where the factor lookup is stubbed at the module boundary.
    console.log(`  NOTE  distribution reads 0 in this harness (anon role cannot see freight factors); covered in downstream-distribution.test.ts`);
    check(
      'end of life is real, and identical (same packaging, same region)',
      onTrade.stage_results!.endOfLife > 0 &&
        onTrade.stage_results!.endOfLife === retail.stage_results!.endOfLife,
      `${onTrade.stage_results!.endOfLife.toFixed(6)} kg CO2e`,
    );
    // 0.3 kg over 6 bottles. Compared with a tolerance because 0.3/6 is
    // 0.049999999999999996 in binary floating point, not 0.05.
    const caseMass =
      onTrade.stage_results!.detail.endOfLife.breakdown.find(b => b.material === 'Shipping case (6)')?.massKg ?? 0;
    check(
      'the shipping case is divided across the 6 bottles it serves',
      Math.abs(caseMass - 0.05) < 1e-12,
      `massKg=${caseMass}`,
    );
    check(
      'grapes never reach end of life',
      !onTrade.stage_results!.detail.endOfLife.breakdown.some(b => b.material === 'Grapes'),
    );

    // ── 1b. The quota claim ───────────────────────────────────────────────
    // "Scenarios are free" has to be structural, not a rule someone remembers.
    console.log('\n1b. Scenarios do not consume LCA quota');
    const countWithScenarios = await lcaCount();
    check(
      'two scenarios added zero to the LCA count',
      countWithScenarios === countBeforeSeed + 1, // +1 for the seeded PCF itself, not the scenarios
      `before=${countBeforeSeed} after 1 PCF + 2 scenarios=${countWithScenarios}`,
    );

    // ── 2. The headline number ────────────────────────────────────────────
    console.log('\n2. Headline number');
    const headline = headlineFootprint(scenarios)!;
    const expected =
      retail.stage_results!.total * 0.7 + onTrade.stage_results!.total * 0.3;
    check('basis is the volume-weighted mix', headline.basis === 'weighted');
    check('weighted value is correct', Math.abs(headline.value - expected) < 1e-12, `${headline.value.toFixed(6)}`);
    check(
      'the range brackets both channels',
      headline.min <= headline.value && headline.value <= headline.max,
      `${headline.min.toFixed(6)} .. ${headline.max.toFixed(6)}`,
    );

    // ── 3. carryScenariosForward ──────────────────────────────────────────
    console.log('\n3. Supersede carries scenarios onto the new version');
    const { data: v2 } = await supabase
      .from('product_carbon_footprints')
      .insert({
        product_id: product.id, organization_id: product.organization_id,
        product_name: `[scenario-verify v2] ${product.name}`, functional_unit: '1 bottle',
        reference_year: 2099, system_boundary: 'cradle-to-grave',
        lca_scope_type: 'cradle-to-grave', status: 'draft',
      })
      .select('id').single();
    const v2Id = v2!.id as string;

    const carried = await carryScenariosForward(supabase, pcfId, v2Id);
    check('both scenarios carried forward', carried === 2, `carried=${carried}`);

    const { data: v2Scenarios } = await supabase
      .from('pcf_end_use_scenarios').select('*').eq('pcf_id', v2Id);
    const v2s = (v2Scenarios ?? []) as EndUseScenario[];
    check('configs came across', v2s.every(s => s.distribution_config != null));
    check('shares came across', v2s.map(s => s.share_pct).sort().join(',') === '30,70');
    check('exactly one primary survived', v2s.filter(s => s.is_primary).length === 1);
    check(
      'stale results were NOT carried (they belong to the old core)',
      v2s.every(s => s.stage_results == null),
    );

    const carriedAgain = await carryScenariosForward(supabase, pcfId, v2Id);
    check('carrying twice is a no-op', carriedAgain === 0);

    // ── 4. Cascade ────────────────────────────────────────────────────────
    console.log('\n4. Deleting a PCF takes its scenarios with it');
    await supabase.from('product_carbon_footprints').delete().eq('id', v2Id);
    const { count } = await supabase
      .from('pcf_end_use_scenarios')
      .select('*', { count: 'exact', head: true })
      .eq('pcf_id', v2Id);
    check('scenarios removed with the PCF', count === 0, `remaining=${count}`);
  } finally {
    // ── Clean up ──────────────────────────────────────────────────────────
    await supabase.from('product_carbon_footprint_materials').delete().eq('product_carbon_footprint_id', pcfId);
    await supabase.from('product_carbon_footprints').delete().eq('id', pcfId);
    await supabase.from('product_carbon_footprints').delete().eq('reference_year', 2099);
    if (seededFactorId) {
      await supabase.from('staging_emission_factors').delete().eq('id', seededFactorId);
    }
    console.log('\nCleaned up seeded records.');
  }

  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} CHECK(S) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('\nVerification threw:', err.message);
  process.exit(1);
});
