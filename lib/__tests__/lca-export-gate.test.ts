import { describe, it, expect, vi } from 'vitest';
import { checkLcaExportGate, BOUNDARY_EXPORT_TIER } from '@/lib/lca/export-gate';

vi.mock('@/lib/provenance/gate', () => ({
  checkProductProvenanceGate: vi.fn(),
}));

import { checkProductProvenanceGate } from '@/lib/provenance/gate';

const provenance = (confirmedPct: number) => {
  (checkProductProvenanceGate as any).mockResolvedValue({
    allowed: confirmedPct >= 80,
    confirmedPct,
    threshold: 80,
    blockers: confirmedPct >= 80 ? [] : [{ area: 'products', confirmedPct, unconfirmedCount: 3, label: 'Products', deepLink: '/products/' }],
  });
};

const db = {} as any;

describe('checkLcaExportGate — the tier gate', () => {
  it('lets a Seed customer share a gate-only footprint', () => {
    expect(BOUNDARY_EXPORT_TIER['cradle-to-gate']).toBe('seed');
  });

  it('refuses a wide footprint on a plan that does not cover it', async () => {
    provenance(100);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-grave', 'seed');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tier');
    expect(result.requiredTier).toBe('canopy');
  });

  it('says the estimate itself stays available, because only sharing is sold', async () => {
    // Boundary width used to be gated at the point of estimating, so a Seed
    // customer could not even see what their full footprint might look like.
    provenance(100);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-grave', 'seed');
    expect(result.message).toContain('keep working with it');
  });

  it('allows the same footprint on a plan that does cover it', async () => {
    provenance(100);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-grave', 'canopy');
    expect(result.allowed).toBe(true);
  });

  it('checks the plan before the data, so nobody confirms an afternoon of figures then hits a paywall', async () => {
    provenance(10);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-grave', 'seed');
    expect(result.reason).toBe('tier');
  });
});

describe('checkLcaExportGate — the confirmed-share gate', () => {
  it('refuses an unconfirmed footprint even on the top plan', async () => {
    // Paying more must never buy the right to publish estimates as fact.
    provenance(35);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-grave', 'canopy');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('provenance');
    expect(result.message).toContain('35%');
  });

  it('allows a confirmed footprint', async () => {
    provenance(85);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-gate', 'seed');
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('carries the blockers through so the refusal can be acted on', async () => {
    provenance(20);
    const result = await checkLcaExportGate(db, 42, 'cradle-to-gate', 'seed');
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

describe('checkLcaExportGate — no boundary set', () => {
  it('falls back to the data gate alone rather than refusing outright', async () => {
    provenance(90);
    const result = await checkLcaExportGate(db, 42, null, 'seed');
    expect(result.allowed).toBe(true);
  });
});
