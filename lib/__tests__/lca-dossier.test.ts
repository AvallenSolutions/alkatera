import { describe, it, expect } from 'vitest';
import { buildDossier, boundaryLabel, type DossierInput } from '@/lib/lca/dossier';

function input(overrides: Partial<DossierInput> = {}): DossierInput {
  return {
    product: { id: 42, name: 'Everleaf Marine' },
    pcf: {
      id: 'pcf-1',
      status: 'completed',
      functional_unit: '1 unit',
      reference_year: 2025,
      system_boundary: 'cradle-to-grave',
      aggregated_impacts: {
        climate_change_gwp100: 1.0,
        climate_biogenic: 0.2,
        breakdown: {
          by_lifecycle_stage: {
            raw_materials: 0.3,
            packaging: 0.2,
            processing: 0.1,
            distribution: 0.05,
            use_phase: 0.02,
            end_of_life: 0.01,
          },
        },
      },
      distribution_config: { legs: [] },
      updated_at: '2026-07-20T10:00:00Z',
    },
    materials: [],
    facilityCount: 1,
    ...overrides,
  };
}

const section = (d: ReturnType<typeof buildDossier>, id: string) =>
  d.sections.find((s) => s.id === id)!;

describe('buildDossier — the headline', () => {
  it('excludes biogenic CO2, matching ISO 14067', () => {
    // 1.0 total less 0.2 biogenic. Reporting the gross figure would overstate
    // the fossil footprint the standard actually asks for.
    expect(buildDossier(input()).headlineKgCo2e).toBeCloseTo(0.8);
  });

  it('has no headline when nothing has been calculated', () => {
    const d = buildDossier(input({ pcf: null }));
    expect(d.headlineKgCo2e).toBeNull();
    expect(d.provenance).toBe('estimated');
  });

  it('does not call a completed calculation "confirmed" when its inputs are estimates', () => {
    // Caught by running the assembler over a real seeded product: the top line
    // read "Confirmed." beside "0% confirmed", because provenance came from
    // the PCF's own status rather than the data underneath it. A finished
    // calculation over industry averages is still estimated.
    const d = buildDossier(
      input({
        pcf: { ...input().pcf!, status: 'completed', system_boundary: 'cradle-to-gate' },
        facilityCount: 0,
        materials: [
          { id: 'm1', material_name: 'Botanicals', material_type: 'ingredient', impact_climate: 0.2, ef_source_type: 'proxy' },
        ],
      }),
    );
    expect(d.pcfStatus).toBe('completed');
    expect(d.provenance).toBe('estimated');
    expect(d.confirmedPct).toBe(0);
  });

  it('keeps the headline provenance and the confirmed share telling the same story', () => {
    const d = buildDossier(input({ pcf: null }));
    expect(d.confirmedPct === 100).toBe(d.provenance === 'confirmed');
  });
});

describe('buildDossier — the unreviewed 50 km default', () => {
  const defaultLeg = {
    legs: [{ id: 'l1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 50 }],
  };

  it('flags the wizard default as unreviewed rather than settled', () => {
    // The wizard injected this on mount and let its own Next button accept it,
    // so an exporter could ship a figure carrying an unexamined local-delivery
    // assumption with nothing on screen saying so.
    const d = buildDossier(
      input({ pcf: { ...input().pcf!, distribution_config: defaultLeg } }),
    );
    const dist = section(d, 'distribution');
    expect(dist.state).toBe('unreviewed');
    expect(dist.provenance).toBe('estimated');
    expect(dist.note).toContain('Nobody has checked');
  });

  it('treats an edited distance as settled', () => {
    const d = buildDossier(
      input({
        pcf: {
          ...input().pcf!,
          distribution_config: {
            legs: [{ id: 'l1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 240 }],
          },
        },
      }),
    );
    expect(section(d, 'distribution').state).toBe('settled');
    expect(section(d, 'distribution').provenance).toBe('confirmed');
  });

  it('treats a different mode at 50 km as settled, not the default', () => {
    const d = buildDossier(
      input({
        pcf: {
          ...input().pcf!,
          distribution_config: {
            legs: [{ id: 'l1', label: 'Factory to retail', transportMode: 'train', distanceKm: 50 }],
          },
        },
      }),
    );
    expect(section(d, 'distribution').state).toBe('settled');
  });

  it('treats two legs as settled even when one is 50 km by lorry', () => {
    const d = buildDossier(
      input({
        pcf: {
          ...input().pcf!,
          distribution_config: {
            legs: [
              { id: 'l1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 50 },
              { id: 'l2', label: 'Retail to shop', transportMode: 'truck', distanceKm: 120 },
            ],
          },
        },
      }),
    );
    expect(section(d, 'distribution').state).toBe('settled');
  });
});

describe('buildDossier — boundary scoping', () => {
  it('marks distribution out of scope for cradle-to-gate, not incomplete', () => {
    // Absent because the study correctly excludes it is a different statement
    // from absent because nobody filled it in.
    const d = buildDossier(
      input({ pcf: { ...input().pcf!, system_boundary: 'cradle-to-gate' } }),
    );
    const dist = section(d, 'distribution');
    expect(dist.state).toBe('out_of_scope');
    expect(dist.kgCo2e).toBeNull();
    expect(dist.note).toContain('factory gate');
  });

  it('marks after-sale out of scope for cradle-to-shelf', () => {
    const d = buildDossier(
      input({ pcf: { ...input().pcf!, system_boundary: 'cradle-to-shelf' } }),
    );
    expect(section(d, 'after').state).toBe('out_of_scope');
    expect(section(d, 'distribution').state).not.toBe('out_of_scope');
  });

  it('excludes out-of-scope sections from the confirmed share', () => {
    // A gate-only study should not be penalised for lacking distribution data
    // it does not need.
    const gate = buildDossier(
      input({ pcf: { ...input().pcf!, system_boundary: 'cradle-to-gate' } }),
    );
    const grave = buildDossier(input());
    expect(gate.confirmedPct).toBeGreaterThan(grave.confirmedPct);
  });
});

describe('buildDossier — materials provenance', () => {
  it('takes the weakest link, because that is the one that embarrasses you', () => {
    const d = buildDossier(
      input({
        materials: [
          { id: 'm1', material_name: 'Glass bottle', material_type: 'packaging', impact_climate: 0.2, ef_source_type: 'ecoinvent', matched_source_name: 'ecoinvent 3.12' },
          { id: 'm2', material_name: 'Bergamot', material_type: 'ingredient', impact_climate: 0.0001, ef_source_type: 'proxy' },
        ],
      }),
    );
    const mats = section(d, 'materials');
    expect(mats.provenance).toBe('estimated');
    expect(mats.state).toBe('unreviewed');
    expect(mats.note).toContain('1 of 2');
  });

  it('orders rows by impact so the figure that matters is read first', () => {
    const d = buildDossier(
      input({
        materials: [
          { id: 'm1', material_name: 'Bergamot', material_type: 'ingredient', impact_climate: 0.0001 },
          { id: 'm2', material_name: 'Glass bottle', material_type: 'packaging', impact_climate: 0.2 },
        ],
      }),
    );
    expect(section(d, 'materials').rows[0].title).toBe('Glass bottle');
  });

  it('says so plainly when there is no recipe yet', () => {
    const d = buildDossier(input({ materials: [] }));
    const mats = section(d, 'materials');
    expect(mats.state).toBe('incomplete');
    expect(mats.kgCo2e).toBeNull();
  });
});

describe('buildDossier — making it', () => {
  it('flags a missing site rather than reporting a confident zero', () => {
    const d = buildDossier(input({ facilityCount: 0 }));
    const making = section(d, 'making');
    expect(making.state).toBe('incomplete');
    expect(making.note).toContain('too low');
  });
});

describe('boundaryLabel', () => {
  it('speaks plainly, keeping ISO phrasing out of the reading line', () => {
    expect(boundaryLabel('cradle-to-gate')).toBe('Up to your factory gate');
    expect(boundaryLabel('cradle-to-grave')).toBe('All the way to the bin');
    expect(boundaryLabel(null)).toBe('Not set yet');
  });
});
