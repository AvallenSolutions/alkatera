/**
 * End-use scenarios: the core is shared, only the journey differs.
 *
 * The claims worth testing here are the ones a customer would notice:
 *   1. Two scenarios over one core never disagree about the core.
 *   2. Recovering the core from a stored PCF is exact, including the loss
 *      multiplier baked into the stored totals.
 *   3. The headline number is the volume-weighted mix once shares are known,
 *      and says so honestly when they are not.
 *
 * See `tasks/lca-end-use-scenarios-plan.md`.
 */

import { describe, it, expect } from 'vitest';
import {
  CHANNEL_PRESETS,
  computeScenario,
  headlineFootprint,
  presetConfigsFor,
  recoverCore,
  type EndUseScenario,
} from '../scenarios';

const MATERIALS = [
  {
    id: 'mat-can', material_name: 'Aluminium Can 330ml', material_type: 'packaging',
    packaging_category: 'aluminium', container_material: 'aluminium',
    quantity: 0.015, unit: 'kg',
  },
  {
    id: 'mat-malt', material_name: 'Pale Malt', material_type: 'ingredient',
    quantity: 0.5, unit: 'kg',
  },
] as any[];

const CONTEXT = { boundary: 'cradle-to-grave', materials: MATERIALS, volumeLitres: 0.33 };
const CORE = 0.752; // the shared cradle-to-gate footprint, from the golden fixtures

const USE_PHASE = {
  needsRefrigeration: true, refrigerationDays: 7, retailFraction: 0.5,
  consumerCountryCode: 'GB', isCarbonated: false,
};

function scenarioRow(over: Partial<EndUseScenario>): EndUseScenario {
  return {
    id: 'sc-1', pcf_id: 'pcf-1', organization_id: 'org-1',
    name: 'Retail', channel: 'off_trade_retail', is_primary: false, share_pct: null,
    distribution_config: null, use_phase_config: null, eol_config: null,
    product_loss_config: null, stage_results: null, computed_at: null, provenance: {},
    ...over,
  } as EndUseScenario;
}

describe('one core, many journeys', () => {
  it('gives every scenario the identical core, whatever the channel', async () => {
    const bar = await computeScenario(
      { ...presetConfigsFor('on_trade', { usePhaseConfig: USE_PHASE, eolConfig: { region: 'eu' }, productWeightKg: 0.5 }) },
      CORE, CONTEXT,
    );
    const retail = await computeScenario(
      { ...presetConfigsFor('off_trade_retail', { usePhaseConfig: USE_PHASE, eolConfig: { region: 'eu' }, productWeightKg: 0.5 }) },
      CORE, CONTEXT,
    );

    // The whole point: the liquid and the bottle are the same product.
    expect(bar.core).toBe(CORE);
    expect(retail.core).toBe(CORE);
    expect(bar.endOfLife).toBe(retail.endOfLife); // same bin region, same packaging

    // ...but the journeys differ, so the totals must too. On-trade assumes a
    // local delivery and lower losses; retail assumes national distribution.
    expect(bar.lossMultiplier).toBeLessThan(retail.lossMultiplier);
    expect(bar.total).not.toBe(retail.total);
  });

  it('applies losses to the core only, never to the downstream stages', async () => {
    const lossy = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' },
        product_loss_config: { distributionLossPercent: 2, retailLossPercent: 3, consumerWastePercent: 5 } },
      CORE, CONTEXT,
    );
    const lossless = await computeScenario(
      { distribution_config: null, use_phase_config: USE_PHASE, eol_config: { region: 'eu' },
        product_loss_config: null },
      CORE, CONTEXT,
    );

    // Downstream stages are already per delivered unit, so they must not move.
    expect(lossy.usePhase).toBe(lossless.usePhase);
    expect(lossy.endOfLife).toBe(lossless.endOfLife);
    // The difference is exactly the inflated core (ISO 14044: lost units still
    // carry their full upstream burden).
    expect(lossy.total - lossless.total).toBeCloseTo(CORE * (lossy.lossMultiplier - 1), 12);
  });

  it('recovers the shared core from a stored PCF exactly', () => {
    // Values captured from the pre-extraction aggregator (see
    // downstream-stages.test.ts). The stored stage totals already carry the
    // 2/3/5% loss multiplier, so recovery must divide it back out.
    const lossMultiplier = 1 / (0.98 * 0.97 * 0.95);
    const recovered = recoverCore(
      { breakdown: { by_lifecycle_stage: { distribution: 0, use_phase: 0.0023717232, end_of_life: 0.00211275 } } },
      0.8371995451213351,
      lossMultiplier,
    );

    expect(recovered).toBeCloseTo(0.752, 12);
  });

  it('treats a gate-only PCF as its own core', () => {
    const recovered = recoverCore(
      { breakdown: { by_lifecycle_stage: { distribution: 0, use_phase: 0, end_of_life: 0 } } },
      0.752,
      1, // no losses beyond the gate
    );
    expect(recovered).toBe(0.752);
  });
});

describe('the headline number', () => {
  const retail = scenarioRow({ id: 'a', name: 'Retail', is_primary: true, stage_results: { total: 2.0 } as any });
  const onTrade = scenarioRow({ id: 'b', name: 'On-trade', channel: 'on_trade', stage_results: { total: 3.0 } as any });

  it('is the volume-weighted mix once shares are known', () => {
    const h = headlineFootprint([
      { ...retail, share_pct: 75 },
      { ...onTrade, share_pct: 25 },
    ]);

    // 0.75 x 2.0 + 0.25 x 3.0 — the number corporate Scope 3 should consume.
    expect(h!.value).toBeCloseTo(2.25, 10);
    expect(h!.basis).toBe('weighted');
    expect(h!.sharesComplete).toBe(true);
    expect(h!.min).toBe(2.0);
    expect(h!.max).toBe(3.0);
  });

  it('falls back to the primary scenario when shares are incomplete', () => {
    const h = headlineFootprint([{ ...retail, share_pct: 75 }, { ...onTrade, share_pct: null }]);

    expect(h!.value).toBe(2.0); // the primary, not an average of the two
    expect(h!.basis).toBe('primary');
    expect(h!.sharesComplete).toBe(false);
  });

  it('refuses shares that do not add up, rather than normalising them silently', () => {
    // 60 + 25 is not a mix, it is a mistake. Leading with a weighted number
    // computed from it would present a guess as arithmetic.
    const h = headlineFootprint([{ ...retail, share_pct: 60 }, { ...onTrade, share_pct: 25 }]);
    expect(h!.basis).toBe('primary');
  });

  it('reports a single scenario plainly', () => {
    const h = headlineFootprint([retail]);
    expect(h!.value).toBe(2.0);
    expect(h!.basis).toBe('single');
    expect(h!.min).toBe(h!.max);
  });

  it('returns nothing when no scenario has been computed yet', () => {
    expect(headlineFootprint([scenarioRow({})])).toBeNull();
  });
});

describe('channel presets', () => {
  it('seeds a journey for every named channel', () => {
    for (const channel of Object.keys(CHANNEL_PRESETS) as Array<keyof typeof CHANNEL_PRESETS>) {
      const configs = presetConfigsFor(channel, { usePhaseConfig: USE_PHASE, productWeightKg: 0.5 });
      expect(configs.distribution_config.legs.length).toBeGreaterThan(0);
      expect(configs.product_loss_config).toBeTruthy();
      // Leg ids must be unique per channel or React keys collide in the editor.
      const ids = configs.distribution_config.legs.map((l: any) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('varies refrigeration by channel but keeps the product facts', () => {
    const bar = presetConfigsFor('on_trade', { usePhaseConfig: USE_PHASE, productWeightKg: 0.5 });
    const dtc = presetConfigsFor('dtc', { usePhaseConfig: USE_PHASE, productWeightKg: 0.5 });

    // A bar chills nearly everything; a direct shipment has no retail leg.
    expect(bar.use_phase_config.retailFraction).toBe(0.8);
    expect(dtc.use_phase_config.retailFraction).toBe(0);
    // Whether the product needs chilling at all is a fact about the product,
    // not the channel, so it must survive untouched.
    expect(bar.use_phase_config.needsRefrigeration).toBe(true);
    expect(dtc.use_phase_config.needsRefrigeration).toBe(true);
  });

  it('does not invent an end-of-life region', () => {
    // Guessing a distance is a small claim; guessing a waste regime is not.
    // The channel hint informs the ask, never the default.
    const configs = presetConfigsFor('export', { usePhaseConfig: USE_PHASE, productWeightKg: 0.5 });
    expect(configs.eol_config).toBeNull();
  });
});
