import { describe, it, expect } from 'vitest';
import { mapSupplyChain, type SupplyChainRaw } from '../supply-chain';

const emptyRaw = (): SupplyChainRaw => ({
  roster: [],
  legacySuppliers: [],
  submissions: [],
});

describe('mapSupplyChain', () => {
  it('returns an empty roster for an org with no suppliers', () => {
    expect(mapSupplyChain(emptyRaw())).toEqual([]);
  });

  it('renames industry_sector to category, defaulting when absent', () => {
    const raw = emptyRaw();
    raw.roster = [
      { name: 'Glassworks Ltd', industry_sector: 'Packaging' },
      { name: 'Mystery Co', industry_sector: null },
    ];
    const out = mapSupplyChain(raw);
    expect(out).toEqual([
      { name: 'Glassworks Ltd', category: 'Packaging', emissionsData: {} },
      { name: 'Mystery Co', category: 'Uncategorised', emissionsData: {} },
    ]);
  });

  it('drops roster rows whose platform supplier record has gone', () => {
    const raw = emptyRaw();
    raw.roster = [{ name: null, industry_sector: null }];
    expect(mapSupplyChain(raw)).toEqual([]);
  });

  it('marks a supplier as having shared data via the name bridge to the legacy table', () => {
    const raw = emptyRaw();
    raw.roster = [
      { name: 'Glassworks Ltd', industry_sector: 'Packaging' },
      { name: 'Cork Supply Co', industry_sector: 'Closures' },
    ];
    raw.legacySuppliers = [
      { id: 'leg-1', name: 'glassworks ltd' }, // case-insensitive match
      { id: 'leg-2', name: 'Unrelated Farm' },
    ];
    raw.submissions = [
      {
        supplier_id: 'leg-1',
        submission_date: '2025-03-01',
        total_utility_entries: 4,
        total_water_entries: 2,
        total_waste_entries: 1,
        total_facility_production_volume: null,
      },
      {
        supplier_id: 'leg-1',
        submission_date: '2025-09-01',
        total_utility_entries: 6,
        total_water_entries: 0,
        total_waste_entries: 0,
        total_facility_production_volume: null,
      },
      // Submission from a supplier not on the platform roster: ignored.
      {
        supplier_id: 'leg-2',
        submission_date: '2025-05-01',
        total_utility_entries: 1,
        total_water_entries: 0,
        total_waste_entries: 0,
        total_facility_production_volume: null,
      },
    ];
    const out = mapSupplyChain(raw);
    const glassworks = out.find((s) => s.name === 'Glassworks Ltd')!;
    const cork = out.find((s) => s.name === 'Cork Supply Co')!;

    // The renderer's "data shared" test is Object.keys(emissionsData).length > 0.
    expect(Object.keys(glassworks.emissionsData).length).toBeGreaterThan(0);
    expect(glassworks.emissionsData).toEqual({
      submissions: 2,
      latestSubmissionDate: '2025-09-01',
      utilityEntries: 10,
      waterEntries: 2,
      wasteEntries: 1,
    });
    expect(cork.emissionsData).toEqual({});
  });
});
