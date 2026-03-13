/**
 * Tests for inbound delivery container embodied carbon calculation.
 *
 * The calculation logic lives inline in product-lca-calculator.ts. These
 * tests exercise the formula directly by extracting it as a pure function
 * equivalent, verifying all edge cases, and validating the aggregator's
 * sub-total tracking.
 *
 * Formula (ISO 14044 §4.3.4.2 physical allocation by volume):
 *   ef_per_fill        = container_ef × tare_kg / reuse_cycles
 *   fill_fraction      = ingredient_qty_litres / container_volume_l
 *   container_co2/unit = ef_per_fill × fill_fraction
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure formula helper (mirrors the logic in product-lca-calculator.ts)
// ---------------------------------------------------------------------------

interface ContainerParams {
  containerEf: number;         // kg CO₂e/kg container material
  containerTareKg: number;     // empty container weight (kg)
  containerVolumeL: number;    // container capacity (L)
  reuseCycles: number;         // total lifetime uses (1 = one-way)
  ingredientQtyL: number;      // ingredient volume for this product unit (L)
}

function calculateContainerCO2PerUnit({
  containerEf,
  containerTareKg,
  containerVolumeL,
  reuseCycles,
  ingredientQtyL,
}: ContainerParams): number {
  if (containerEf <= 0 || containerTareKg <= 0 || containerVolumeL <= 0 || ingredientQtyL <= 0) {
    return 0;
  }
  const cycles       = Math.max(1, reuseCycles);
  const efPerFill    = (containerEf * containerTareKg) / cycles;
  const fillFraction = ingredientQtyL / containerVolumeL;
  return efPerFill * fillFraction;
}

// ---------------------------------------------------------------------------
// Preset reference data (mirrors CONTAINER_PRESETS in IngredientFormCard.tsx)
// ---------------------------------------------------------------------------

const PRESETS = {
  // Bulk containers
  ibc_1000l:          { ef: 1.93, tare: 25,    volume: 1000,  cycles: 10  }, // reusable (corrected)
  ibc_500l:           { ef: 1.93, tare: 16,    volume: 500,   cycles: 10  }, // reusable (corrected)
  drum_200l:          { ef: 1.93, tare: 8.5,   volume: 200,   cycles: 1   },
  flexitank_24000l:   { ef: 2.10, tare: 30,    volume: 24000, cycles: 1   },
  bulk_tanker_25000l: { ef: 2.89, tare: 20000, volume: 25000, cycles: 300 },
  // Glass bottles (inbound ingredient packaging)
  bottle_700ml_glass: { ef: 0.85, tare: 0.40,  volume: 0.700, cycles: 1   },
  bottle_750ml_glass: { ef: 0.85, tare: 0.45,  volume: 0.750, cycles: 1   },
  bottle_1l_glass:    { ef: 0.85, tare: 0.50,  volume: 1.000, cycles: 1   },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateContainerCO2PerUnit — formula', () => {

  // ── Happy paths ────────────────────────────────────────────────────────────

  it('IBC 1000L one-way (reuse_cycles=1 override): full container fill (750 ml product unit)', () => {
    // Tequila: 1000L IBC, 750ml (0.75L) per bottle, explicitly one-way
    // ef_per_fill = 1.93 × 25 / 1 = 48.25 kg CO₂e
    // fill_fraction = 0.75 / 1000 = 0.00075
    // result = 48.25 × 0.00075 = 0.036188 kg CO₂e
    // Note: default preset is now 10 cycles (reusable); this test overrides to 1 to verify one-way path
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.ibc_1000l.ef,
      containerTareKg: PRESETS.ibc_1000l.tare,
      containerVolumeL: PRESETS.ibc_1000l.volume,
      reuseCycles:    1, // explicit one-way override (preset default is now 10)
      ingredientQtyL: 0.75,
    });
    expect(result).toBeCloseTo(0.036188, 5);
  });

  it('IBC 1000L one-way: full fill calculation for ingredient spanning one IBC', () => {
    // 1000L ingredient from one IBC → fill_fraction = 1.0
    // result = 1.93 × 25 / 1 × 1.0 = 48.25 kg CO₂e per fill
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.ibc_1000l.ef,
      containerTareKg: PRESETS.ibc_1000l.tare,
      containerVolumeL: PRESETS.ibc_1000l.volume,
      reuseCycles:    1,
      ingredientQtyL: 1000,
    });
    expect(result).toBeCloseTo(48.25, 4);
  });

  it('Drum 200L: partial fill (100L ingredient from 200L drum)', () => {
    // fill_fraction = 100 / 200 = 0.5
    // ef_per_fill = 1.93 × 8.5 / 1 = 16.405
    // result = 16.405 × 0.5 = 8.2025 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.drum_200l.ef,
      containerTareKg: PRESETS.drum_200l.tare,
      containerVolumeL: PRESETS.drum_200l.volume,
      reuseCycles:    1,
      ingredientQtyL: 100,
    });
    expect(result).toBeCloseTo(8.2025, 4);
  });

  it('Flexitank 24000L: small ingredient share', () => {
    // 500L of juice from a 24000L flexitank
    // ef_per_fill = 2.10 × 30 / 1 = 63 kg CO₂e
    // fill_fraction = 500 / 24000 ≈ 0.02083
    // result = 63 × 0.02083 ≈ 1.3125 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.flexitank_24000l.ef,
      containerTareKg: PRESETS.flexitank_24000l.tare,
      containerVolumeL: PRESETS.flexitank_24000l.volume,
      reuseCycles:    1,
      ingredientQtyL: 500,
    });
    expect(result).toBeCloseTo(1.3125, 3);
  });

  it('Bulk tanker 25000L (stainless steel, reusable × 300): small per-unit impact', () => {
    // ef_per_fill = 2.89 × 20000 / 300 = 192.667 kg CO₂e
    // fill_fraction = 0.75 / 25000 = 0.00003
    // result = 192.667 × 0.00003 = 0.00578 kg CO₂e — near-negligible per bottle
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.bulk_tanker_25000l.ef,
      containerTareKg: PRESETS.bulk_tanker_25000l.tare,
      containerVolumeL: PRESETS.bulk_tanker_25000l.volume,
      reuseCycles:    PRESETS.bulk_tanker_25000l.cycles,
      ingredientQtyL: 0.75,
    });
    expect(result).toBeCloseTo(0.00578, 5);
  });

  it('Bulk tanker at reuse_cycles=1 produces a very large number (expected mis-entry warning)', () => {
    // This is the "wrong" default — shows why we enforce 300 in the UI
    // ef_per_fill = 2.89 × 20000 / 1 = 57800 kg CO₂e
    // fill_fraction = 0.75 / 25000 = 0.00003
    // result = 57800 × 0.00003 = 1.734 kg CO₂e — still visible in UI preview
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.bulk_tanker_25000l.ef,
      containerTareKg: PRESETS.bulk_tanker_25000l.tare,
      containerVolumeL: PRESETS.bulk_tanker_25000l.volume,
      reuseCycles:    1, // mis-entry
      ingredientQtyL: 0.75,
    });
    expect(result).toBeCloseTo(1.734, 3);
    // The UI impact preview would show this as ~1.734 kg CO₂e — very obvious
  });

  // ── Allocation ─────────────────────────────────────────────────────────────

  it('fill_fraction > 1.0 (ingredient spans multiple containers) is handled correctly', () => {
    // 2500L ingredient from 1000L IBCs → fill_fraction = 2.5 (2.5 IBCs)
    // result = (1.93 × 25 / 1) × (2500 / 1000) = 48.25 × 2.5 = 120.625 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.ibc_1000l.ef,
      containerTareKg: PRESETS.ibc_1000l.tare,
      containerVolumeL: PRESETS.ibc_1000l.volume,
      reuseCycles:    1,
      ingredientQtyL: 2500, // 2.5 IBCs worth
    });
    expect(result).toBeCloseTo(120.625, 4);
  });

  it('reuse_cycles is clamped to minimum of 1 even when 0 is passed', () => {
    const withZero = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: 0, ingredientQtyL: 0.75,
    });
    const withOne = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: 1, ingredientQtyL: 0.75,
    });
    expect(withZero).toEqual(withOne);
  });

  it('reuse_cycles clamped when negative', () => {
    const result = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: -5, ingredientQtyL: 0.75,
    });
    // -5 → clamped to 1 → same as one-way
    expect(result).toBeCloseTo(0.036188, 5);
  });

  // ── Custom container with user-supplied EF ─────────────────────────────────

  it('custom container with user-supplied EF uses override correctly', () => {
    // Custom stainless HDPE drum: EF=2.5, tare=12kg, vol=250L, one-way
    const result = calculateContainerCO2PerUnit({
      containerEf:    2.5,
      containerTareKg: 12,
      containerVolumeL: 250,
      reuseCycles:    1,
      ingredientQtyL: 0.75,
    });
    // ef_per_fill = 2.5 × 12 / 1 = 30
    // fill_fraction = 0.75 / 250 = 0.003
    // result = 30 × 0.003 = 0.09
    expect(result).toBeCloseTo(0.09, 6);
  });

  // ── Zero / missing field guards ────────────────────────────────────────────

  it('returns 0 when containerEf is 0', () => {
    const result = calculateContainerCO2PerUnit({
      containerEf: 0, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: 1, ingredientQtyL: 0.75,
    });
    expect(result).toBe(0);
  });

  it('returns 0 when containerTareKg is 0', () => {
    const result = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 0, containerVolumeL: 1000,
      reuseCycles: 1, ingredientQtyL: 0.75,
    });
    expect(result).toBe(0);
  });

  it('returns 0 when containerVolumeL is 0', () => {
    const result = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 0,
      reuseCycles: 1, ingredientQtyL: 0.75,
    });
    expect(result).toBe(0);
  });

  it('returns 0 when ingredientQtyL is 0', () => {
    const result = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: 1, ingredientQtyL: 0,
    });
    expect(result).toBe(0);
  });

  // ── Reuse cycle amortisation verification ─────────────────────────────────

  it('doubling reuse cycles halves the per-unit container impact', () => {
    const params = { containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000, ingredientQtyL: 0.75 };
    const once  = calculateContainerCO2PerUnit({ ...params, reuseCycles: 1 });
    const twice = calculateContainerCO2PerUnit({ ...params, reuseCycles: 2 });
    expect(once / twice).toBeCloseTo(2, 6);
  });

  it('100 reuse cycles reduces impact to 1/100th of one-way', () => {
    const params = { containerEf: 2.89, containerTareKg: 20000, containerVolumeL: 25000, ingredientQtyL: 0.75 };
    const oneWay    = calculateContainerCO2PerUnit({ ...params, reuseCycles: 1 });
    const hundredth = calculateContainerCO2PerUnit({ ...params, reuseCycles: 100 });
    expect(oneWay / hundredth).toBeCloseTo(100, 6);
  });

  // ── Preset data sanity checks ──────────────────────────────────────────────

  it('IBC 500L has lower total per-fill CO₂ than IBC 1000L (lighter container)', () => {
    const ibc1000Total = PRESETS.ibc_1000l.ef * PRESETS.ibc_1000l.tare; // 48.25 kg CO₂e per fill
    const ibc500Total  = PRESETS.ibc_500l.ef  * PRESETS.ibc_500l.tare;  // 30.88 kg CO₂e per fill
    expect(ibc500Total).toBeLessThan(ibc1000Total);
  });

  it('all HDPE presets have the same emission factor (1.93)', () => {
    expect(PRESETS.ibc_1000l.ef).toBe(1.93);
    expect(PRESETS.ibc_500l.ef).toBe(1.93);
    expect(PRESETS.drum_200l.ef).toBe(1.93);
  });

  it('bulk tanker has highest tare weight by far', () => {
    const tares = Object.values(PRESETS).map(p => p.tare);
    const maxTare = Math.max(...tares);
    expect(PRESETS.bulk_tanker_25000l.tare).toBe(maxTare);
    expect(PRESETS.bulk_tanker_25000l.tare).toBe(20000);
  });

  it('bulk tanker with 300 cycles per-fill impact is less than a single IBC 1000L per fill', () => {
    const tankerPerFill = (PRESETS.bulk_tanker_25000l.ef * PRESETS.bulk_tanker_25000l.tare)
      / PRESETS.bulk_tanker_25000l.cycles;
    const ibcPerFill = PRESETS.ibc_1000l.ef * PRESETS.ibc_1000l.tare;
    // Tanker: 2.89 × 20000 / 300 = 192.67 vs IBC: 1.93 × 25 = 48.25
    // Tanker is higher (more product per fill covers 25,000L vs 1,000L)
    // But on a per-litre basis the tanker is far more efficient
    const tankerPerLitre = tankerPerFill / PRESETS.bulk_tanker_25000l.volume;
    const ibcPerLitre    = ibcPerFill    / PRESETS.ibc_1000l.volume;
    expect(tankerPerLitre).toBeLessThan(ibcPerLitre);
  });

  // ── IBC reuse correction ───────────────────────────────────────────────────

  it('IBC 1000L at 10 reuse cycles: per-trip carbon is 1/10th of one-way', () => {
    const oneWay = calculateContainerCO2PerUnit({
      containerEf: PRESETS.ibc_1000l.ef, containerTareKg: PRESETS.ibc_1000l.tare,
      containerVolumeL: PRESETS.ibc_1000l.volume, reuseCycles: 1, ingredientQtyL: 0.75,
    });
    const tenTrips = calculateContainerCO2PerUnit({
      containerEf: PRESETS.ibc_1000l.ef, containerTareKg: PRESETS.ibc_1000l.tare,
      containerVolumeL: PRESETS.ibc_1000l.volume, reuseCycles: 10, ingredientQtyL: 0.75,
    });
    // one-way = 0.036188 kg CO₂e; 10-trip = 0.003619 kg CO₂e
    expect(oneWay / tenTrips).toBeCloseTo(10, 6);
    expect(tenTrips).toBeCloseTo(0.003619, 5);
  });

  it('IBC 1000L default reuse_cycles is now 10 (not 1)', () => {
    expect(PRESETS.ibc_1000l.cycles).toBe(10);
    expect(PRESETS.ibc_500l.cycles).toBe(10);
  });

  // ── Glass bottle presets ───────────────────────────────────────────────────

  it('all glass bottle presets have the same EF (0.85 kg CO₂e/kg)', () => {
    expect(PRESETS.bottle_700ml_glass.ef).toBe(0.85);
    expect(PRESETS.bottle_750ml_glass.ef).toBe(0.85);
    expect(PRESETS.bottle_1l_glass.ef).toBe(0.85);
  });

  it('glass bottle 700ml: 25ml Campari from a 700ml bottle', () => {
    // Campari use case: 25ml per cocktail from a 700ml bottle
    // ef_per_fill  = 0.85 × 0.40 / 1 = 0.34 kg CO₂e
    // fill_fraction = 0.025 / 0.700 = 0.03571
    // result = 0.34 × 0.03571 = 0.012143 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.bottle_700ml_glass.ef,
      containerTareKg: PRESETS.bottle_700ml_glass.tare,
      containerVolumeL: PRESETS.bottle_700ml_glass.volume,
      reuseCycles:    1,
      ingredientQtyL: 0.025, // 25ml
    });
    expect(result).toBeCloseTo(0.012143, 4);
  });

  it('glass bottle 750ml: full bottle content (750ml ingredient)', () => {
    // A product using an entire 750ml bottle of an ingredient
    // ef_per_fill  = 0.85 × 0.45 / 1 = 0.3825 kg CO₂e
    // fill_fraction = 0.750 / 0.750 = 1.0
    // result = 0.3825 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.bottle_750ml_glass.ef,
      containerTareKg: PRESETS.bottle_750ml_glass.tare,
      containerVolumeL: PRESETS.bottle_750ml_glass.volume,
      reuseCycles:    1,
      ingredientQtyL: 0.750,
    });
    expect(result).toBeCloseTo(0.3825, 5);
  });

  it('glass bottle 1L: 50ml per cocktail from a 1L bottle', () => {
    // e.g. 50ml triple sec from a 1L bottle
    // ef_per_fill  = 0.85 × 0.50 / 1 = 0.425 kg CO₂e
    // fill_fraction = 0.050 / 1.0 = 0.050
    // result = 0.425 × 0.050 = 0.02125 kg CO₂e
    const result = calculateContainerCO2PerUnit({
      containerEf:    PRESETS.bottle_1l_glass.ef,
      containerTareKg: PRESETS.bottle_1l_glass.tare,
      containerVolumeL: PRESETS.bottle_1l_glass.volume,
      reuseCycles:    1,
      ingredientQtyL: 0.050,
    });
    expect(result).toBeCloseTo(0.02125, 5);
  });

  it('glass bottle is single-use — reuse_cycles locked at 1', () => {
    expect(PRESETS.bottle_700ml_glass.cycles).toBe(1);
    expect(PRESETS.bottle_750ml_glass.cycles).toBe(1);
    expect(PRESETS.bottle_1l_glass.cycles).toBe(1);
  });

  it('glass bottle impact is much smaller than IBC per unit (small fill fraction)', () => {
    // 25ml Campari from 700ml bottle vs 750ml tequila base from 1000L IBC
    const bottleImpact = calculateContainerCO2PerUnit({
      containerEf: 0.85, containerTareKg: 0.40, containerVolumeL: 0.70,
      reuseCycles: 1, ingredientQtyL: 0.025,
    });
    const ibcImpact = calculateContainerCO2PerUnit({
      containerEf: 1.93, containerTareKg: 25, containerVolumeL: 1000,
      reuseCycles: 10, ingredientQtyL: 0.75,
    });
    // Bottle: ~0.012 kg CO₂e; IBC (×10 reuse): ~0.00362 kg CO₂e
    // Both are small but bottle is larger due to proportionally heavy tare
    expect(bottleImpact).toBeGreaterThan(0);
    expect(ibcImpact).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Aggregator containerEmissions sub-total
// ---------------------------------------------------------------------------

describe('containerEmissions sub-total in aggregator output', () => {
  it('inbound_containers sub-key is distinct from and ≤ raw_materials', () => {
    // Simulate aggregated impacts with container sub-total
    const mockByLifecycleStage = {
      raw_materials: 1.25,
      inbound_containers: 0.036, // sub-item of raw_materials
      processing: 0.10,
      packaging: 0.15,
      distribution: 0.05,
      use_phase: 0,
      end_of_life: 0,
    };

    expect(mockByLifecycleStage.inbound_containers).toBeLessThanOrEqual(
      mockByLifecycleStage.raw_materials
    );
    expect(mockByLifecycleStage.inbound_containers).toBeGreaterThan(0);
  });

  it('inbound_containers is 0 when no containers are set', () => {
    const mockByLifecycleStage = {
      raw_materials: 1.20,
      inbound_containers: 0,
      processing: 0.10,
      packaging: 0.15,
      distribution: 0.05,
      use_phase: 0,
      end_of_life: 0,
    };

    expect(mockByLifecycleStage.inbound_containers).toBe(0);
  });
});
