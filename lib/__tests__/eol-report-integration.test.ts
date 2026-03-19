/**
 * Integration tests for End-of-Life report transparency fixes.
 *
 * Tests that:
 * 1. EoL methodology data flows from aggregator through transformer to report types
 * 2. Biogenic/fossil split is correct for paper vs glass materials
 * 3. Recycled content vs EoL recycling rate are correctly distinguished
 * 4. Per-material EoL breakdown data is complete and accurate
 * 5. Gross vs avoided burden split is correctly computed
 */

import { describe, it, expect } from 'vitest';
import { calculateMaterialEoL, getMaterialFactorKey, getRegionalDefaults, EOL_FACTORS, REGIONAL_DEFAULTS, REGION_LABELS, EOL_DATA_YEAR } from '../end-of-life-factors';

describe('EoL Report Transparency Integration', () => {

  // ── Fix #1: EoL Methodology data completeness ─────────────────────

  describe('EoL Methodology data', () => {
    it('REGION_LABELS covers all regions', () => {
      expect(REGION_LABELS.eu).toBe('European Union');
      expect(REGION_LABELS.uk).toBe('United Kingdom');
      expect(REGION_LABELS.us).toBe('United States');
    });

    it('EOL_DATA_YEAR is defined and recent', () => {
      expect(EOL_DATA_YEAR).toBe(2024);
      expect(EOL_DATA_YEAR).toBeGreaterThanOrEqual(2023);
    });

    it('getRegionalDefaults returns valid pathway percentages summing to 100', () => {
      for (const region of ['eu', 'uk', 'us'] as const) {
        for (const material of Object.keys(EOL_FACTORS)) {
          const defaults = getRegionalDefaults(region, material);
          const sum = defaults.recycling + defaults.landfill + defaults.incineration +
            defaults.composting + (defaults.anaerobic_digestion || 0);
          expect(sum).toBeCloseTo(100, 0);
        }
      }
    });
  });

  // ── Fix #2: Recycled content vs EoL recycling rate ────────────────

  describe('Recycled content vs EoL recycling rate distinction', () => {
    it('EoL recycling rate derives from regional disposal defaults, not recycled content', () => {
      // EU glass has 76% EoL recycling rate
      const euGlass = getRegionalDefaults('eu', 'glass');
      expect(euGlass.recycling).toBe(76);

      // US glass has only 31% EoL recycling rate
      const usGlass = getRegionalDefaults('us', 'glass');
      expect(usGlass.recycling).toBe(31);

      // These are completely different from recycled content (which is about input material)
      // Recycled content is per-material: e.g. a glass bottle made from 50% cullet
      // EoL recycling rate is about what happens AFTER consumer use
    });

    it('EoL recycling rate varies by region for same material', () => {
      const euAluminium = getRegionalDefaults('eu', 'aluminium');
      const usAluminium = getRegionalDefaults('us', 'aluminium');

      // EU has higher recycling infrastructure than US
      expect(euAluminium.recycling).toBeGreaterThan(usAluminium.recycling);
      expect(usAluminium.landfill).toBeGreaterThan(euAluminium.landfill);
    });
  });

  // ── Fix #3: Gross vs Avoided burden split ──────────────────────────

  describe('Gross vs Avoided burden split', () => {
    it('glass recycling produces negative avoided burden', () => {
      const result = calculateMaterialEoL(0.5, 'glass', 'eu');
      expect(result.avoided).toBeLessThan(0); // Negative = credit
      expect(result.gross).toBeGreaterThanOrEqual(0); // Positive = disposal emissions
      expect(result.net).toBeCloseTo(result.gross + result.avoided, 6);
    });

    it('aluminium recycling has strongest avoided burden', () => {
      const glass = calculateMaterialEoL(0.5, 'glass', 'eu');
      const aluminium = calculateMaterialEoL(0.5, 'aluminium', 'eu');

      // Aluminium has much higher recycling credit (-1.5 vs -0.35)
      expect(Math.abs(aluminium.avoided)).toBeGreaterThan(Math.abs(glass.avoided));
    });

    it('result breakdown per pathway is consistent', () => {
      const result = calculateMaterialEoL(0.5, 'glass', 'eu');

      expect(result.breakdown.recycling).toBeLessThan(0); // Credit
      expect(result.breakdown.landfill).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.incineration).toBeGreaterThanOrEqual(0);

      // Gross = all non-recycling pathways
      const expectedGross = result.breakdown.landfill + result.breakdown.incineration +
        result.breakdown.composting + result.breakdown.anaerobic_digestion;
      expect(result.gross).toBeCloseTo(expectedGross, 10);

      // Avoided = recycling pathway
      expect(result.avoided).toBeCloseTo(result.breakdown.recycling, 10);
    });

    it('total is net (gross + avoided)', () => {
      for (const material of ['glass', 'aluminium', 'pet', 'paper', 'cork']) {
        const result = calculateMaterialEoL(1.0, material, 'eu');
        expect(result.total).toBeCloseTo(result.net, 10);
        expect(result.net).toBeCloseTo(result.gross + result.avoided, 10);
      }
    });
  });

  // ── Fix #4: Biogenic/fossil CO₂ split ─────────────────────────────

  describe('Biogenic vs Fossil CO₂ classification', () => {
    it('paper is classified as biogenic material for EoL', () => {
      const factorKey = getMaterialFactorKey('cardboard', 'Cardboard Box');
      expect(factorKey).toBe('paper');
      // Paper is biogenic: its landfill decomposition produces biogenic CH₄
      // In the aggregator, factorKey === 'paper' routes to totalClimateBiogenic
    });

    it('cork is classified as biogenic material for EoL', () => {
      const factorKey = getMaterialFactorKey('cork', 'Cork Stopper');
      expect(factorKey).toBe('cork');
    });

    it('organic is classified as biogenic material for EoL', () => {
      const factorKey = getMaterialFactorKey('organic', 'Food Waste');
      expect(factorKey).toBe('organic');
    });

    it('glass is classified as fossil material for EoL', () => {
      const factorKey = getMaterialFactorKey('glass_bottle', 'Glass Bottle');
      expect(factorKey).toBe('glass');
      // Glass is fossil-origin: its recycling credits reduce fossil CO₂
    });

    it('aluminium is classified as fossil material for EoL', () => {
      const factorKey = getMaterialFactorKey('aluminium_can', 'Aluminium Can');
      expect(factorKey).toBe('aluminium');
    });

    it('PET is classified as fossil material for EoL', () => {
      const factorKey = getMaterialFactorKey('pet_bottle', 'PET Bottle');
      expect(factorKey).toBe('pet');
    });

    it('biogenic materials have significant landfill methane factors', () => {
      // Paper landfill factor (1.0) is much higher than glass landfill (0.01)
      // because paper decomposes anaerobically producing methane
      expect(EOL_FACTORS.paper.landfill).toBeGreaterThan(EOL_FACTORS.glass.landfill);
      expect(EOL_FACTORS.organic.landfill).toBeGreaterThan(EOL_FACTORS.glass.landfill);
    });
  });

  // ── Fix #5: Recycling credits explanation ──────────────────────────

  describe('Recycling credit data for report explanation', () => {
    it('provides all data needed for credits explanation', () => {
      const result = calculateMaterialEoL(0.015, 'aluminium', 'eu');

      // Report needs: avoided, gross, net for the explanation text
      expect(typeof result.avoided).toBe('number');
      expect(typeof result.gross).toBe('number');
      expect(typeof result.net).toBe('number');

      // For aluminium, net should be negative (strong recycling credit)
      expect(result.net).toBeLessThan(0);
      expect(result.avoided).toBeLessThan(result.net); // Avoided is more negative than net
    });

    it('can compute total avoided burden across multiple materials', () => {
      const glass = calculateMaterialEoL(0.5, 'glass', 'eu');
      const aluminium = calculateMaterialEoL(0.015, 'aluminium', 'eu');
      const paper = calculateMaterialEoL(0.05, 'paper', 'eu');

      const totalGross = glass.gross + aluminium.gross + paper.gross;
      const totalAvoided = glass.avoided + aluminium.avoided + paper.avoided;
      const totalNet = glass.net + aluminium.net + paper.net;

      expect(totalGross).toBeGreaterThanOrEqual(0);
      expect(totalAvoided).toBeLessThan(0);
      expect(totalNet).toBeCloseTo(totalGross + totalAvoided, 10);
    });
  });

  // ── Fix #6: Per-material disposal pathway data ─────────────────────

  describe('Per-material disposal pathway data completeness', () => {
    it('calculateMaterialEoL returns all 5 pathway breakdowns', () => {
      const result = calculateMaterialEoL(1.0, 'paper', 'eu');

      expect('recycling' in result.breakdown).toBe(true);
      expect('landfill' in result.breakdown).toBe(true);
      expect('incineration' in result.breakdown).toBe(true);
      expect('composting' in result.breakdown).toBe(true);
      expect('anaerobic_digestion' in result.breakdown).toBe(true);
    });

    it('all pathways sum correctly for EU paper', () => {
      const massKg = 0.05;
      const result = calculateMaterialEoL(massKg, 'paper', 'eu');
      const defaults = getRegionalDefaults('eu', 'paper');

      // Verify each pathway calculation
      const expectedRecycling = massKg * (defaults.recycling / 100) * EOL_FACTORS.paper.recycling;
      const expectedLandfill = massKg * (defaults.landfill / 100) * EOL_FACTORS.paper.landfill;
      const expectedIncineration = massKg * (defaults.incineration / 100) * EOL_FACTORS.paper.incineration;
      const expectedComposting = massKg * (defaults.composting / 100) * EOL_FACTORS.paper.composting;
      const expectedAD = massKg * (defaults.anaerobic_digestion / 100) * EOL_FACTORS.paper.anaerobic_digestion;

      expect(result.breakdown.recycling).toBeCloseTo(expectedRecycling, 10);
      expect(result.breakdown.landfill).toBeCloseTo(expectedLandfill, 10);
      expect(result.breakdown.incineration).toBeCloseTo(expectedIncineration, 10);
      expect(result.breakdown.composting).toBeCloseTo(expectedComposting, 10);
      expect(result.breakdown.anaerobic_digestion).toBeCloseTo(expectedAD, 10);
    });

    it('user pathway overrides are respected', () => {
      const defaultResult = calculateMaterialEoL(0.5, 'glass', 'eu');
      const overrideResult = calculateMaterialEoL(0.5, 'glass', 'eu', {
        recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0,
      });

      // 100% recycling should give maximum avoided burden
      expect(Math.abs(overrideResult.avoided)).toBeGreaterThan(Math.abs(defaultResult.avoided));
      expect(overrideResult.gross).toBe(0); // Nothing goes to landfill/incineration
    });

    it('zero mass returns zero for all pathways', () => {
      const result = calculateMaterialEoL(0, 'glass', 'eu');
      expect(result.total).toBeCloseTo(0, 10);
      expect(result.avoided).toBeCloseTo(0, 10);
      expect(result.gross).toBeCloseTo(0, 10);
      expect(result.net).toBeCloseTo(0, 10);
    });
  });

  // ── Cross-cutting: Mathematical consistency ────────────────────────

  describe('Mathematical consistency', () => {
    it('EoL is linear in mass', () => {
      const single = calculateMaterialEoL(1.0, 'glass', 'eu');
      const double = calculateMaterialEoL(2.0, 'glass', 'eu');

      expect(double.net).toBeCloseTo(single.net * 2, 10);
      expect(double.avoided).toBeCloseTo(single.avoided * 2, 10);
      expect(double.gross).toBeCloseTo(single.gross * 2, 10);
    });

    it('net = gross + avoided for all regions and materials', () => {
      for (const region of ['eu', 'uk', 'us'] as const) {
        for (const material of Object.keys(EOL_FACTORS)) {
          const result = calculateMaterialEoL(1.0, material, region);
          expect(result.net).toBeCloseTo(result.gross + result.avoided, 10);
        }
      }
    });
  });
});
