/**
 * Scope 3 across routes to market.
 *
 * This is the number that reaches a corporate inventory, so the safety
 * property matters more than the feature: a corporate total must never move
 * because the platform started guessing at a sales mix. Until the user answers
 * the split, every caller keeps the stored figure and nothing anywhere changes.
 *
 * Corporate reporting consumes Scope 3 rather than the headline because
 * facility Scope 1 and 2 are already in the inventory; counting the product's
 * copy of them again would double-count.
 */

import { describe, it, expect } from 'vitest';
import { computeScenario, weightedScope3PerUnit, type EndUseScenario } from '../scenarios';

const CONTEXT = {
  boundary: 'cradle-to-grave',
  materials: [
    {
      id: 'm1', material_name: 'Glass bottle', material_type: 'packaging',
      packaging_category: 'container', container_material: 'glass',
      quantity: 0.45, unit: 'kg',
    },
  ] as any[],
  volumeLitres: 0.7,
};

const LOSS = { distributionLossPercent: 2, retailLossPercent: 3, consumerWastePercent: 5 };
const USE_PHASE = {
  needsRefrigeration: true, refrigerationDays: 5, retailFraction: 0.5,
  consumerCountryCode: 'GB', isCarbonated: false,
};

function scenarioRow(over: Partial<EndUseScenario>): EndUseScenario {
  return {
    id: 'sc', pcf_id: 'pcf-1', organization_id: 'org-1', name: 'Retail',
    channel: 'off_trade_retail', is_primary: true, share_pct: null,
    distribution_config: null, use_phase_config: null, eol_config: null,
    product_loss_config: null, stage_results: null, computed_at: null, provenance: {},
    ...over,
  } as EndUseScenario;
}

describe('per-scenario Scope 3', () => {
  it('scales upstream by losses and adds the downstream stages', async () => {
    const r = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' }, product_loss_config: LOSS },
      0.9,
      { ...CONTEXT, coreScope3: 0.7 },
    );

    // Every downstream stage is Scope 3 (GHG Protocol categories 4, 9, 11, 12),
    // so scope3 = upstream x losses + all of the downstream.
    const expected = 0.7 * r.lossMultiplier + r.distribution + r.usePhase + r.endOfLife;
    expect(r.scope3).toBeCloseTo(expected, 12);
    // And it must be strictly below the headline, which also carries Scope 1/2.
    expect(r.scope3!).toBeLessThan(r.total);
  });

  it('is null when the footprint has no scope breakdown to recover from', async () => {
    const r = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' }, product_loss_config: null },
      0.9,
      { ...CONTEXT, coreScope3: null },
    );
    // Null, not zero: a missing breakdown is not the same as no emissions, and
    // zero would quietly shrink somebody's inventory.
    expect(r.scope3).toBeNull();
  });

  it('differs by channel exactly as the loss and journey differ', async () => {
    const light = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' },
        product_loss_config: { distributionLossPercent: 1, retailLossPercent: 2, consumerWastePercent: 1 } },
      0.9, { ...CONTEXT, coreScope3: 0.7 },
    );
    const heavy = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' }, product_loss_config: LOSS },
      0.9, { ...CONTEXT, coreScope3: 0.7 },
    );

    expect(heavy.scope3!).toBeGreaterThan(light.scope3!);
  });
});

describe('weighted Scope 3 for the corporate inventory', () => {
  const retail = scenarioRow({
    id: 'a', name: 'Retail', is_primary: true,
    stage_results: { total: 2.0, scope3: 1.6 } as any,
  });
  const onTrade = scenarioRow({
    id: 'b', name: 'On-trade', channel: 'on_trade', is_primary: false,
    stage_results: { total: 3.0, scope3: 2.4 } as any,
  });

  it('weights by sales share once the split is known', () => {
    const w = weightedScope3PerUnit([
      { ...retail, share_pct: 75 },
      { ...onTrade, share_pct: 25 },
    ]);
    expect(w).toBeCloseTo(1.6 * 0.75 + 2.4 * 0.25, 12);
  });

  it('refuses to weight while any share is unknown', () => {
    // The safety property. Returning the primary here instead of null would
    // silently change a corporate total the moment a second route was added.
    expect(weightedScope3PerUnit([{ ...retail, share_pct: 75 }, onTrade])).toBeNull();
  });

  it('refuses when one route is unknown even though the others total 100', () => {
    // The case the sum check alone cannot catch, and the dangerous one: with
    // retail at 100% and on-trade unanswered, the shares still add to 100, so
    // only the explicit null guard stops us treating the unknown route as zero
    // volume and reporting 1.6 as though the split were confirmed.
    expect(
      weightedScope3PerUnit([{ ...retail, share_pct: 100 }, { ...onTrade, share_pct: null }]),
    ).toBeNull();
  });

  it('refuses a split that does not add up', () => {
    expect(
      weightedScope3PerUnit([{ ...retail, share_pct: 60 }, { ...onTrade, share_pct: 25 }]),
    ).toBeNull();
  });

  it('returns null for a single-route product, leaving the stored figure alone', () => {
    expect(weightedScope3PerUnit([{ ...retail, share_pct: 100 }])).toBeNull();
  });

  it('ignores routes with no computed Scope 3', () => {
    const uncomputed = scenarioRow({ id: 'c', name: 'Export', channel: 'export', share_pct: 25, stage_results: null });
    // Two computed routes remain but their shares now total 75, so there is no
    // honest mix to report.
    expect(
      weightedScope3PerUnit([{ ...retail, share_pct: 50 }, { ...onTrade, share_pct: 25 }, uncomputed]),
    ).toBeNull();
  });
});
