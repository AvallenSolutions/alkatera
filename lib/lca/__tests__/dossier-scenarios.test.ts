/**
 * The dossier's view of routes to market.
 *
 * The claims that matter to a reader:
 *   - a product sold one way shows no scenario machinery at all
 *   - the headline is the weighted mix once shares are known, and says so when
 *     it is not
 *   - each route carries its own distribution and "after it is sold", judged
 *     by the same rules as the single-route dossier
 */

import { describe, it, expect } from 'vitest';
import { buildDossier, type DossierInput } from '../dossier';

const PCF = {
  id: 'pcf-1',
  status: 'completed',
  functional_unit: '1 bottle',
  reference_year: 2026,
  system_boundary: 'cradle-to-grave',
  aggregated_impacts: {
    climate_change_gwp100: 1.0,
    climate_biogenic: 0,
    breakdown: {
      by_lifecycle_stage: {
        raw_materials: 0.6,
        packaging: 0.3,
        processing: 0.05,
        distribution: 0.03,
        use_phase: 0.01,
        end_of_life: 0.01,
      },
    },
  },
  distribution_config: {
    legs: [{ id: 'l1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 50 }],
  },
  updated_at: '2026-07-21T00:00:00Z',
};

const BASE: DossierInput = {
  product: { id: 12, name: 'Orchard Calvados' },
  pcf: PCF as any,
  materials: [
    { id: 'm1', material_name: 'Apples', material_type: 'ingredient', impact_climate: 0.6 },
    { id: 'm2', material_name: 'Glass bottle', material_type: 'packaging', impact_climate: 0.3 },
  ],
  facilityCount: 1,
};

function route(over: Partial<any> = {}) {
  return {
    id: 'sc-retail',
    name: 'Retail (off-trade)',
    channel: 'off_trade_retail',
    is_primary: true,
    share_pct: null,
    distribution_config: {
      legs: [
        { id: 'a', label: 'Factory to distribution centre', transportMode: 'truck', distanceKm: 200 },
        { id: 'b', label: 'Distribution centre to retail', transportMode: 'truck', distanceKm: 150 },
      ],
    },
    stage_results: { total: 1.05, distribution: 0.08, usePhase: 0.01, endOfLife: 0.01 },
    ...over,
  };
}

const ON_TRADE = route({
  id: 'sc-bar',
  name: 'On-trade',
  channel: 'on_trade',
  is_primary: false,
  distribution_config: {
    legs: [{ id: 'c', label: 'Factory to retail', transportMode: 'truck', distanceKm: 50 }],
  },
  stage_results: { total: 0.97, distribution: 0.01, usePhase: 0.02, endOfLife: 0.01 },
});

describe('a product sold one way', () => {
  it('shows no routes and no headline, so nothing implies a choice nobody made', () => {
    const d = buildDossier(BASE);
    expect(d.scenarios).toEqual([]);
    expect(d.headline).toBeNull();
  });

  it('still shows no routes when exactly one scenario exists', () => {
    // One route needs no switcher. The scenario exists in the database from the
    // migration backfill, but surfacing it would be machinery without a purpose.
    const d = buildDossier({ ...BASE, scenarios: [route()] as any });
    expect(d.scenarios).toEqual([]);
    expect(d.headline).toBeNull();
  });

  it('keeps distribution and after in the main sections', () => {
    const d = buildDossier(BASE);
    expect(d.sections.map((s) => s.id)).toContain('distribution');
    expect(d.sections.map((s) => s.id)).toContain('after');
  });
});

describe('a product sold several ways', () => {
  const scenarios = [route(), ON_TRADE] as any;

  it('leads with the main route while the sales split is unknown', () => {
    const d = buildDossier({ ...BASE, scenarios });
    expect(d.headline).not.toBeNull();
    expect(d.headline!.basis).toBe('primary');
    expect(d.headline!.value).toBe(1.05); // the primary, not an average
    expect(d.headline!.sharesComplete).toBe(false);
  });

  it('leads with the volume-weighted mix once shares are known', () => {
    const d = buildDossier({
      ...BASE,
      scenarios: [route({ share_pct: 70 }), { ...ON_TRADE, share_pct: 30 }] as any,
    });
    expect(d.headline!.basis).toBe('weighted');
    expect(d.headline!.value).toBeCloseTo(1.05 * 0.7 + 0.97 * 0.3, 10);
    expect(d.headline!.sharesComplete).toBe(true);
  });

  it('refuses a split that does not add up rather than normalising it', () => {
    // 60 + 25 is a typo, not a mix. Rescaling it would present a mistake as
    // arithmetic.
    const d = buildDossier({
      ...BASE,
      scenarios: [route({ share_pct: 60 }), { ...ON_TRADE, share_pct: 25 }] as any,
    });
    expect(d.headline!.basis).toBe('primary');
  });

  it('reports the range across routes', () => {
    const d = buildDossier({ ...BASE, scenarios });
    expect(d.headline!.min).toBe(0.97);
    expect(d.headline!.max).toBe(1.05);
  });

  it('gives each route its own distribution, judged by the same rules', () => {
    const d = buildDossier({ ...BASE, scenarios });
    const retail = d.scenarios.find((s) => s.channel === 'off_trade_retail')!;
    const bar = d.scenarios.find((s) => s.channel === 'on_trade')!;

    // Retail has a real two-leg route somebody chose.
    expect(retail.sections.distribution.state).toBe('settled');
    expect(retail.sections.distribution.rows).toHaveLength(2);

    // The bar route is still the untouched 50 km default, and must be called
    // out as unchecked exactly as the single-route dossier would.
    expect(bar.sections.distribution.state).toBe('unreviewed');
    expect(bar.sections.distribution.provenance).toBe('estimated');
  });

  it('gives each route its own after-it-is-sold figures', () => {
    const d = buildDossier({ ...BASE, scenarios });
    const retail = d.scenarios.find((s) => s.channel === 'off_trade_retail')!;
    const bar = d.scenarios.find((s) => s.channel === 'on_trade')!;

    // A bar chills more of its stock, so the use phase is larger there.
    expect(bar.sections.after.kgCo2e).toBeGreaterThan(retail.sections.after.kgCo2e!);
  });

  it('ignores routes that have never been computed', () => {
    // A route with no numbers cannot be shown or weighted; it would render as
    // an empty state, and the dossier exists so there are none.
    const d = buildDossier({
      ...BASE,
      scenarios: [route(), ON_TRADE, route({ id: 'sc-new', name: 'Export', channel: 'export', is_primary: false, stage_results: null })] as any,
    });
    expect(d.scenarios).toHaveLength(2);
    expect(d.scenarios.map((s) => s.channel)).not.toContain('export');
  });

  it('carries the shares through for display', () => {
    const d = buildDossier({
      ...BASE,
      scenarios: [route({ share_pct: 70 }), { ...ON_TRADE, share_pct: 30 }] as any,
    });
    expect(d.scenarios.map((s) => s.sharePct).sort()).toEqual([30, 70]);
  });
});

describe('a gate-only footprint', () => {
  it('marks every route\'s downstream sections out of scope', () => {
    const d = buildDossier({
      ...BASE,
      pcf: { ...PCF, system_boundary: 'cradle-to-gate' } as any,
      scenarios: [route(), ON_TRADE] as any,
    });
    for (const s of d.scenarios) {
      expect(s.sections.distribution.state).toBe('out_of_scope');
      expect(s.sections.after.state).toBe('out_of_scope');
    }
  });
});
