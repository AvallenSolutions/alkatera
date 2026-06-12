/**
 * Fix #3 regression: the Water Footprint, Land Use and Supply Chain tables used
 * to slice the first 8 materials in stored order, hiding the largest contributors
 * (e.g. the biggest juice ingredient). They must now:
 *   - sort by the relevant metric descending (largest always shown),
 *   - cap at a page-safe row count,
 *   - surface any remainder with an explicit "+ N more materials" overflow row.
 */

import { describe, it, expect } from 'vitest';
import { transformLCADataForReport } from '../utils/lca-report-transformer';

// 16 materials: more than the page-safe cap (14), so 2 must overflow.
// Distinct, deliberately *anti-correlated* metrics so each table's sort is
// exercised independently:
//   impact_water  decreasing with index (Mat00 highest)
//   impact_land   increasing with index (Mat15 highest)
//   distance_km   increasing with index (Mat15 furthest)
const MATERIALS = Array.from({ length: 16 }, (_, i) => ({
  id: `mat-${i}`,
  material_name: `Mat${String(i).padStart(2, '0')}`,
  material_type: 'ingredient',
  origin_country: 'Spain',
  quantity: 0.1,
  unit: 'kg',
  impact_water: 16 - i,
  impact_land: i,
  distance_km: i * 100,
}));

const waterSum = MATERIALS.reduce((s, m) => s + m.impact_water, 0);
const landSum = MATERIALS.reduce((s, m) => s + m.impact_land, 0);

const LCA: any = {
  id: 'lca-001',
  product_name: 'Test Shots 420ml',
  system_boundary: 'cradle-to-grave',
  materials: MATERIALS,
  product_lca_materials: MATERIALS,
  aggregated_impacts: {
    climate_change_gwp100: 0.5,
    climate_biogenic: 0,
    water_consumption: waterSum,   // == material sum, so no "Processing" row
    water_scarcity_aware: 0,
    land_use: landSum,             // == material sum, so no "Processing" row
    breakdown: {
      by_lifecycle_stage: { raw_materials: 0.5 },
      by_scope: { scope3: 0.5 },
      by_ghg: {},
      by_material: [],
      flag_removals: null,
    },
    data_quality: {},
  },
};

// Three provenance archetypes for the ingredient breakdown: supplier-verified,
// live-database (ecoinvent), and proxy fallback. The report (on-screen page +
// PDF) renders a source badge, quality grade chip and confidence score per
// row, so these fields must survive the transform for every archetype.
const PROVENANCE_MATERIALS = [
  {
    id: 'mat-supplier',
    material_name: 'Organic Apple Juice',
    material_type: 'ingredient',
    quantity: 0.4,
    unit: 'kg',
    impact_climate: 0.2,
    impact_source: 'primary_verified',
    data_priority: 1,
    data_quality_grade: 'HIGH',
    confidence_score: 95,
  },
  {
    id: 'mat-openlca',
    material_name: 'Cane Sugar',
    material_type: 'ingredient',
    quantity: 0.1,
    unit: 'kg',
    impact_climate: 0.1,
    impact_source: 'secondary_modelled',
    gwp_data_source: 'Ecoinvent 3.12',
    data_quality_grade: 'MEDIUM',
    confidence_score: 80,
  },
  {
    id: 'mat-proxy',
    material_name: 'Yuzu Extract',
    material_type: 'ingredient',
    quantity: 0.01,
    unit: 'kg',
    impact_climate: 0.05,
    impact_source: 'hybrid_proxy',
    matched_source_name: 'Citrus fruit, processed',
    gwp_data_source: 'AGRIBALYSE 3.2',
    data_quality_grade: 'LOW',
    confidence_score: 50,
  },
];

describe('LCA report transformer — ingredient provenance fields', () => {
  const lca: any = {
    ...LCA,
    materials: PROVENANCE_MATERIALS,
    product_lca_materials: PROVENANCE_MATERIALS,
  };
  const report: any = transformLCADataForReport(lca, null, null);
  const rows = report.ingredientBreakdown.ingredients;
  const byName = (n: string) => rows.find((r: any) => r.name === n);

  it('carries source, grade and confidence for a supplier-verified ingredient', () => {
    const row = byName('Organic Apple Juice');
    expect(row.dataSource).toBe('Primary');
    expect(row.factorDatabase).toBe('Supplier verified');
    expect(row.dataQualityGrade).toBe('HIGH');
    expect(row.confidenceScore).toBe(95);
    expect(row.isProxy).toBe(false);
  });

  it('carries source, grade and confidence for a live-database ingredient', () => {
    const row = byName('Cane Sugar');
    expect(row.dataSource).toBe('Secondary');
    expect(row.factorDatabase).toBe('ecoinvent 3.12');
    expect(row.dataQualityGrade).toBe('MEDIUM');
    expect(row.confidenceScore).toBe(80);
  });

  it('carries source, grade, confidence and proxy identity for a proxy ingredient', () => {
    const row = byName('Yuzu Extract');
    expect(row.dataSource).toBe('Proxy');
    expect(row.isProxy).toBe(true);
    expect(row.calculationFactor).toBe('Citrus fruit, processed');
    expect(row.factorDatabase).toBe('AGRIBALYSE 3.2');
    expect(row.dataQualityGrade).toBe('LOW');
    expect(row.confidenceScore).toBe(50);
  });
});

describe('LCA report transformer — Water / Land / Supply tables', () => {
  const report: any = transformLCADataForReport(LCA, null, null);

  it('Water Footprint lists all 14 page-safe rows + an overflow summary, sorted by volume desc', () => {
    const sources = report.waterFootprint.sources;
    const named = sources.filter((s: any) => !s.source.startsWith('+ '));
    const overflow = sources.find((s: any) => s.source.startsWith('+ '));

    expect(named).toHaveLength(14);
    // Highest-water material (Mat00) is first; was at risk of being hidden before.
    expect(named[0].source).toBe('Mat00');
    // The two lowest-water materials overflow rather than vanishing silently.
    expect(overflow).toBeDefined();
    expect(overflow.source).toContain('2 more');
    expect(named.map((s: any) => s.source)).not.toContain('Mat15');
  });

  it('Land Use sorts independently by footprint desc (Mat15 first, not Mat00)', () => {
    const rows = report.landUse.breakdown;
    const named = rows.filter((r: any) => !r.material.startsWith('+ '));
    const overflow = rows.find((r: any) => r.material.startsWith('+ '));

    expect(named).toHaveLength(14);
    expect(named[0].material).toBe('Mat15'); // highest land footprint
    expect(named.map((r: any) => r.material)).not.toContain('Mat00'); // lowest land, overflowed
    expect(overflow).toBeDefined();
    expect(overflow.material).toContain('2 more');
  });

  it('Supply Chain sorts by distance desc and overflows the shortest legs', () => {
    const items = report.supplyChain.network[0].items;
    const named = items.filter((i: any) => !i.name.startsWith('+ '));
    const overflow = items.find((i: any) => i.name.startsWith('+ '));

    expect(named).toHaveLength(14);
    expect(named[0].name).toBe('Mat15'); // furthest leg
    expect(overflow).toBeDefined();
    expect(overflow.name).toContain('2 more');
  });

  it('shows every material (no overflow row) when within the page-safe limit', () => {
    const ten = MATERIALS.slice(0, 10);
    const tenWaterSum = ten.reduce((s, m) => s + m.impact_water, 0);
    const small = {
      ...LCA,
      materials: ten,
      product_lca_materials: ten,
      aggregated_impacts: { ...LCA.aggregated_impacts, water_consumption: tenWaterSum },
    };
    const r: any = transformLCADataForReport(small, null, null);
    const sources = r.waterFootprint.sources;
    // No overflow row, and every one of the 10 materials is present.
    expect(sources.find((s: any) => s.source.startsWith('+ '))).toBeUndefined();
    for (const m of ten) {
      expect(sources.map((s: any) => s.source)).toContain(m.material_name);
    }
  });
});
