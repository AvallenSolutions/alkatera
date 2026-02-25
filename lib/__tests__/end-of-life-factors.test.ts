/**
 * End-of-Life Factors Test Suite
 *
 * Tests material type mapping, disposal pathway calculations,
 * regional defaults, pathway overrides, and recycling credits.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateMaterialEoL,
  getMaterialFactorKey,
  getRegionalDefaults,
  getEoLMaterialTypes,
  EOL_FACTORS,
  REGIONAL_DEFAULTS,
  MATERIAL_TYPE_LABELS,
  EOL_DATA_YEAR,
  REGION_LABELS,
  type EoLRegion,
  type MaterialEoLResult,
} from '../end-of-life-factors';

// ============================================================================
// MATERIAL TYPE MAPPING
// ============================================================================

describe('getMaterialFactorKey', () => {
  it('maps glass_bottle to glass', () => {
    expect(getMaterialFactorKey('glass_bottle')).toBe('glass');
  });

  it('maps glass_jar to glass', () => {
    expect(getMaterialFactorKey('glass_jar')).toBe('glass');
  });

  it('maps aluminium_can to aluminium', () => {
    expect(getMaterialFactorKey('aluminium_can')).toBe('aluminium');
  });

  it('maps aluminum_can (US spelling) to aluminium', () => {
    expect(getMaterialFactorKey('aluminum_can')).toBe('aluminium');
  });

  it('maps alu_can to aluminium', () => {
    expect(getMaterialFactorKey('alu_can')).toBe('aluminium');
  });

  it('maps pet_bottle to pet', () => {
    expect(getMaterialFactorKey('pet_bottle')).toBe('pet');
  });

  it('maps plastic_bottle to pet', () => {
    expect(getMaterialFactorKey('plastic_bottle')).toBe('pet');
  });

  it('maps cardboard to paper', () => {
    expect(getMaterialFactorKey('cardboard')).toBe('paper');
  });

  it('maps cardboard_box to paper', () => {
    expect(getMaterialFactorKey('cardboard_box')).toBe('paper');
  });

  it('maps label to paper', () => {
    expect(getMaterialFactorKey('label')).toBe('paper');
  });

  it('maps steel_can to steel', () => {
    expect(getMaterialFactorKey('steel_can')).toBe('steel');
  });

  it('maps crown_cap to steel', () => {
    expect(getMaterialFactorKey('crown_cap')).toBe('steel');
  });

  it('maps cork to cork', () => {
    expect(getMaterialFactorKey('cork')).toBe('cork');
  });

  it('maps cork_stopper to cork', () => {
    expect(getMaterialFactorKey('cork_stopper')).toBe('cork');
  });

  it('maps ingredient to organic', () => {
    expect(getMaterialFactorKey('ingredient')).toBe('organic');
  });

  it('returns "other" for unknown materials', () => {
    expect(getMaterialFactorKey('unknown_material')).toBe('other');
  });

  it('handles empty string → other', () => {
    expect(getMaterialFactorKey('')).toBe('other');
  });

  it('normalises case and whitespace', () => {
    expect(getMaterialFactorKey('Glass Bottle')).toBe('glass');
    expect(getMaterialFactorKey(' ALUMINIUM_CAN ')).toBe('aluminium');
    expect(getMaterialFactorKey('PET bottle')).toBe('pet');
  });

  it('maps hdpe_bottle to hdpe', () => {
    expect(getMaterialFactorKey('hdpe_bottle')).toBe('hdpe');
  });
});

// ============================================================================
// EOL_FACTORS STRUCTURE
// ============================================================================

describe('EOL_FACTORS', () => {
  it('has factors for all expected material types', () => {
    const expectedTypes = ['glass', 'aluminium', 'pet', 'hdpe', 'paper', 'steel', 'organic', 'cork', 'other'];
    for (const type of expectedTypes) {
      expect(EOL_FACTORS[type]).toBeDefined();
    }
  });

  it('recycling factors are negative (avoided burden) for key materials', () => {
    expect(EOL_FACTORS.glass.recycling).toBeLessThan(0);
    expect(EOL_FACTORS.aluminium.recycling).toBeLessThan(0);
    expect(EOL_FACTORS.pet.recycling).toBeLessThan(0);
    expect(EOL_FACTORS.steel.recycling).toBeLessThan(0);
  });

  it('aluminium has the highest recycling credit (most energy-intensive virgin production)', () => {
    const maxCredit = Math.min(
      EOL_FACTORS.glass.recycling,
      EOL_FACTORS.aluminium.recycling,
      EOL_FACTORS.pet.recycling,
      EOL_FACTORS.steel.recycling,
    );
    expect(maxCredit).toBe(EOL_FACTORS.aluminium.recycling);
  });

  it('landfill factors are non-negative', () => {
    for (const [, factors] of Object.entries(EOL_FACTORS)) {
      expect(factors.landfill).toBeGreaterThanOrEqual(0);
    }
  });

  it('each material type has all 5 pathway factors', () => {
    for (const [, factors] of Object.entries(EOL_FACTORS)) {
      expect(typeof factors.recycling).toBe('number');
      expect(typeof factors.landfill).toBe('number');
      expect(typeof factors.incineration).toBe('number');
      expect(typeof factors.composting).toBe('number');
      expect(typeof factors.anaerobic_digestion).toBe('number');
    }
  });
});

// ============================================================================
// REGIONAL DEFAULTS
// ============================================================================

describe('REGIONAL_DEFAULTS', () => {
  const regions: EoLRegion[] = ['eu', 'uk', 'us'];
  const materialTypes = ['glass', 'aluminium', 'pet', 'hdpe', 'paper', 'steel', 'organic', 'cork', 'other'];

  it('defines defaults for all 3 regions', () => {
    for (const region of regions) {
      expect(REGIONAL_DEFAULTS[region]).toBeDefined();
    }
  });

  it('each region has defaults for all material types', () => {
    for (const region of regions) {
      for (const material of materialTypes) {
        expect(REGIONAL_DEFAULTS[region][material]).toBeDefined();
      }
    }
  });

  it('pathway percentages sum to 100 for each material in each region', () => {
    for (const region of regions) {
      for (const material of materialTypes) {
        const d = REGIONAL_DEFAULTS[region][material];
        const sum = d.recycling + d.landfill + d.incineration + d.composting + d.anaerobic_digestion;
        expect(sum).toBeCloseTo(100, 0);
      }
    }
  });

  it('EU has higher recycling rates than US for glass', () => {
    expect(REGIONAL_DEFAULTS.eu.glass.recycling).toBeGreaterThan(REGIONAL_DEFAULTS.us.glass.recycling);
  });

  it('US has higher landfill rates than EU for most materials', () => {
    expect(REGIONAL_DEFAULTS.us.glass.landfill).toBeGreaterThan(REGIONAL_DEFAULTS.eu.glass.landfill);
    expect(REGIONAL_DEFAULTS.us.aluminium.landfill).toBeGreaterThan(REGIONAL_DEFAULTS.eu.aluminium.landfill);
  });

  it('organic materials have non-zero composting and anaerobic_digestion in EU', () => {
    expect(REGIONAL_DEFAULTS.eu.organic.composting).toBeGreaterThan(0);
    expect(REGIONAL_DEFAULTS.eu.organic.anaerobic_digestion).toBeGreaterThan(0);
  });

  it('non-organic materials (glass, aluminium) have 0% composting', () => {
    for (const region of regions) {
      expect(REGIONAL_DEFAULTS[region].glass.composting).toBe(0);
      expect(REGIONAL_DEFAULTS[region].aluminium.composting).toBe(0);
    }
  });
});

describe('getRegionalDefaults', () => {
  it('returns correct defaults for glass in EU', () => {
    const defaults = getRegionalDefaults('eu', 'glass');
    expect(defaults.recycling).toBe(76);
    expect(defaults.landfill).toBe(10);
    expect(defaults.incineration).toBe(14);
  });

  it('returns "other" defaults for unknown material type', () => {
    const defaults = getRegionalDefaults('eu', 'unicorn_material');
    expect(defaults).toEqual(REGIONAL_DEFAULTS.eu.other);
  });
});

// ============================================================================
// calculateMaterialEoL — GLASS
// ============================================================================

describe('calculateMaterialEoL — Glass', () => {
  it('EU glass (1kg): net negative due to high recycling rate', () => {
    const result = calculateMaterialEoL(1.0, 'glass', 'eu');

    // 76% recycled × -0.35 = -0.266
    // 10% landfill × 0.01 = 0.001
    // 14% incineration × 0.01 = 0.0014
    // composting/AD = 0
    expect(result.avoided).toBeCloseTo(1.0 * 0.76 * (-0.35), 4);
    expect(result.gross).toBeGreaterThan(0);
    expect(result.net).toBeLessThan(0); // Net credit
    expect(result.total).toBe(result.net);
  });

  it('US glass (1kg): less negative than EU due to lower recycling', () => {
    const euResult = calculateMaterialEoL(1.0, 'glass', 'eu');
    const usResult = calculateMaterialEoL(1.0, 'glass', 'us');

    // US 33% recycling vs EU 76% → US net is less negative (closer to zero or positive)
    expect(usResult.net).toBeGreaterThan(euResult.net);
  });
});

// ============================================================================
// calculateMaterialEoL — ALUMINIUM
// ============================================================================

describe('calculateMaterialEoL — Aluminium', () => {
  it('EU aluminium (15g): significant negative net (recycling credit)', () => {
    const massKg = 0.015; // 15g aluminium can
    const result = calculateMaterialEoL(massKg, 'aluminium', 'eu');

    // 75% recycled × -1.5 = large negative credit
    expect(result.avoided).toBeLessThan(0);
    expect(result.net).toBeLessThan(0);

    // Credit magnitude should be much larger than gross emissions for aluminium
    expect(Math.abs(result.avoided)).toBeGreaterThan(result.gross);
  });

  it('aluminium has the most negative net per kg of all materials', () => {
    const glass1kg = calculateMaterialEoL(1.0, 'glass', 'eu');
    const alu1kg = calculateMaterialEoL(1.0, 'aluminium', 'eu');
    const pet1kg = calculateMaterialEoL(1.0, 'pet', 'eu');
    const steel1kg = calculateMaterialEoL(1.0, 'steel', 'eu');

    expect(alu1kg.net).toBeLessThan(glass1kg.net);
    expect(alu1kg.net).toBeLessThan(pet1kg.net);
    expect(alu1kg.net).toBeLessThan(steel1kg.net);
  });
});

// ============================================================================
// calculateMaterialEoL — PET
// ============================================================================

describe('calculateMaterialEoL — PET', () => {
  it('PET incineration is a major emission source (high fossil polymer factor)', () => {
    const result = calculateMaterialEoL(1.0, 'pet', 'eu');

    // Incineration factor = 2.3 kg CO2e/kg — dominant emission pathway for PET
    const incinerationEmission = 1.0 * (REGIONAL_DEFAULTS.eu.pet.incineration / 100) * EOL_FACTORS.pet.incineration;
    expect(result.breakdown.incineration).toBeCloseTo(incinerationEmission, 4);
    expect(result.breakdown.incineration).toBeGreaterThan(result.breakdown.landfill);
  });

  it('PET net is positive (incineration > recycling credit)', () => {
    const result = calculateMaterialEoL(1.0, 'pet', 'eu');
    // PET recycling credit is small (-0.04) but incineration is huge (2.3)
    expect(result.net).toBeGreaterThan(0);
  });
});

// ============================================================================
// calculateMaterialEoL — ZERO MASS
// ============================================================================

describe('calculateMaterialEoL — Zero mass', () => {
  it('zero mass returns all-zero result', () => {
    const result = calculateMaterialEoL(0, 'aluminium', 'eu');
    // Use toBeCloseTo to handle JavaScript -0 vs 0 (0 * negative = -0)
    expect(result.total).toBeCloseTo(0, 10);
    expect(result.avoided).toBeCloseTo(0, 10);
    expect(result.gross).toBeCloseTo(0, 10);
    expect(result.net).toBeCloseTo(0, 10);
    for (const value of Object.values(result.breakdown)) {
      expect(value).toBeCloseTo(0, 10);
    }
  });
});

// ============================================================================
// PATHWAY OVERRIDES
// ============================================================================

describe('Pathway overrides', () => {
  it('user override replaces regional default for specific pathway', () => {
    // Override aluminium to 100% recycling
    const result = calculateMaterialEoL(1.0, 'aluminium', 'eu', {
      recycling: 100,
      landfill: 0,
      incineration: 0,
      composting: 0,
      anaerobic_digestion: 0,
    });

    // 100% recycled × -1.5 = -1.5
    expect(result.avoided).toBeCloseTo(-1.5, 4);
    expect(result.gross).toBe(0);
    expect(result.net).toBeCloseTo(-1.5, 4);
  });

  it('100% landfill produces only landfill emissions', () => {
    const result = calculateMaterialEoL(1.0, 'glass', 'eu', {
      recycling: 0,
      landfill: 100,
      incineration: 0,
      composting: 0,
      anaerobic_digestion: 0,
    });

    expect(result.avoided).toBeCloseTo(0, 6);
    expect(result.breakdown.landfill).toBeCloseTo(1.0 * 0.01, 4); // glass landfill = 0.01
    expect(result.breakdown.recycling).toBeCloseTo(0, 6);
    expect(result.breakdown.incineration).toBeCloseTo(0, 6);
  });

  it('partial override: only recycling specified, rest comes from defaults', () => {
    const result = calculateMaterialEoL(1.0, 'glass', 'eu', {
      recycling: 90,
    });

    // Recycling overridden to 90%, but landfill/incineration/etc. use EU defaults
    const recyclingEmission = 1.0 * (90 / 100) * EOL_FACTORS.glass.recycling;
    expect(result.breakdown.recycling).toBeCloseTo(recyclingEmission, 4);

    // Landfill uses EU default (10%)
    const landfillEmission = 1.0 * (REGIONAL_DEFAULTS.eu.glass.landfill / 100) * EOL_FACTORS.glass.landfill;
    expect(result.breakdown.landfill).toBeCloseTo(landfillEmission, 4);
  });
});

// ============================================================================
// BREAKDOWN CONSISTENCY
// ============================================================================

describe('Breakdown consistency', () => {
  it('net = gross + avoided', () => {
    const materials = ['glass', 'aluminium', 'pet', 'paper', 'steel', 'organic', 'cork', 'other'];
    const regions: EoLRegion[] = ['eu', 'uk', 'us'];

    for (const material of materials) {
      for (const region of regions) {
        const result = calculateMaterialEoL(1.0, material, region);
        expect(result.net).toBeCloseTo(result.gross + result.avoided, 6);
        expect(result.total).toBeCloseTo(result.net, 6);
      }
    }
  });

  it('breakdown sum = net total', () => {
    const result = calculateMaterialEoL(1.0, 'aluminium', 'eu');
    const breakdownSum = Object.values(result.breakdown).reduce((s, v) => s + v, 0);
    expect(breakdownSum).toBeCloseTo(result.net, 6);
  });

  it('avoided = recycling breakdown value', () => {
    const result = calculateMaterialEoL(1.0, 'glass', 'eu');
    expect(result.avoided).toBeCloseTo(result.breakdown.recycling, 6);
  });

  it('gross = landfill + incineration + composting + anaerobic_digestion', () => {
    const result = calculateMaterialEoL(1.0, 'paper', 'eu');
    const grossFromBreakdown = result.breakdown.landfill +
      result.breakdown.incineration +
      result.breakdown.composting +
      result.breakdown.anaerobic_digestion;
    expect(result.gross).toBeCloseTo(grossFromBreakdown, 6);
  });
});

// ============================================================================
// UNKNOWN MATERIAL TYPE — FALLBACK
// ============================================================================

describe('Unknown material type fallback', () => {
  it('uses "other" factors for unknown material types', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = calculateMaterialEoL(1.0, 'unicorn_material', 'eu');

    // Should use 'other' factors
    expect(result.breakdown.recycling).toBeCloseTo(
      1.0 * (REGIONAL_DEFAULTS.eu.other.recycling / 100) * EOL_FACTORS.other.recycling,
      4,
    );
    consoleSpy.mockRestore();
  });

  it('uses "other" regional defaults when specific material not found (no warning because "other" exists)', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 'completely_unknown_xyz' is not in REGIONAL_DEFAULTS.eu, but 'other' IS,
    // so the fallback to REGIONAL_DEFAULTS.eu.other kicks in without the hardcoded
    // fallback warning. The warning only fires when even 'other' is missing from the region.
    calculateMaterialEoL(1.0, 'completely_unknown_xyz', 'eu');

    // Should NOT warn because 'other' defaults exist in all regions
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('No regional defaults for material type'),
    );
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// MISCELLANEOUS
// ============================================================================

describe('Utility functions and constants', () => {
  it('getEoLMaterialTypes returns all factor keys', () => {
    const types = getEoLMaterialTypes();
    expect(types).toContain('glass');
    expect(types).toContain('aluminium');
    expect(types).toContain('pet');
    expect(types).toContain('paper');
    expect(types).toContain('steel');
    expect(types).toContain('organic');
    expect(types).toContain('other');
  });

  it('MATERIAL_TYPE_LABELS has human-readable labels for all types', () => {
    for (const key of getEoLMaterialTypes()) {
      expect(MATERIAL_TYPE_LABELS[key]).toBeTruthy();
    }
  });

  it('EOL_DATA_YEAR is 2024', () => {
    expect(EOL_DATA_YEAR).toBe(2024);
  });

  it('REGION_LABELS has labels for all regions', () => {
    expect(REGION_LABELS.eu).toBe('European Union');
    expect(REGION_LABELS.uk).toBe('United Kingdom');
    expect(REGION_LABELS.us).toBe('United States');
  });
});

// ============================================================================
// SCALING
// ============================================================================

describe('Mass scaling', () => {
  it('emissions scale linearly with mass', () => {
    const result1kg = calculateMaterialEoL(1.0, 'glass', 'eu');
    const result2kg = calculateMaterialEoL(2.0, 'glass', 'eu');

    expect(result2kg.net).toBeCloseTo(result1kg.net * 2, 6);
    expect(result2kg.avoided).toBeCloseTo(result1kg.avoided * 2, 6);
    expect(result2kg.gross).toBeCloseTo(result1kg.gross * 2, 6);
  });

  it('small masses (15g aluminium can) produce small but non-zero results', () => {
    const result = calculateMaterialEoL(0.015, 'aluminium', 'eu');
    expect(result.net).not.toBe(0);
    expect(Math.abs(result.net)).toBeLessThan(0.1); // Small for 15g
    expect(Math.abs(result.net)).toBeGreaterThan(0.0001);
  });
});
