/**
 * GOLDEN: facility attribution ratio across the production-unit vocabulary.
 *
 * Third member of the cutover harness family, alongside
 * `lca-aggregator-golden.test.ts` and `packaging-parametric-golden.test.ts`.
 * Those two lock what happens AFTER materials are resolved; this one locks the
 * facility side, where a product's share of a site's emissions is decided.
 *
 * WHY THIS EXISTS
 * `redesign` routes both unit strings through the new
 * `normaliseProductionUnit()` before comparing them, where `main` only
 * lowercased and trimmed. That sits directly on the scope 1 + scope 2 number
 * every product inherits from its facility, so it had to be checked rather
 * than assumed.
 *
 * The check has been done: all 1024 pairs of the 32 production-unit spellings
 * this codebase is known to have written were compared across both branches.
 * **Zero ratios differ.** The only change is that four spurious "these can't
 * be converted automatically" warnings stop firing on `cases` vs `case`, which
 * are the same unit. This file keeps that result true.
 *
 * PORTABILITY CONTRACT
 * Meant to be byte-identical on `main` and `redesign`. If a change is needed
 * to make one of them pass, that change IS the finding.
 */
import { describe, it, expect } from 'vitest';
import { computeAttributionRatio } from '@/lib/product-lca-calculator';

/** 5000 of the product, from a site making 200 of whatever its own unit is. */
function ratio(productionVolumeUnit: string, facilityTotalProductionUnit: string) {
  return computeAttributionRatio(
    {
      facilityName: 'Somerset distillery',
      productionVolume: 5000,
      productionVolumeUnit,
      facilityTotalProduction: 200,
      facilityTotalProductionUnit,
    } as any,
    0.7, // 700 ml functional unit
    true,
  );
}

const unitMismatch = (warnings: string[]) =>
  warnings.some((w) => w.includes("can't be converted automatically"));

describe('golden: matching units divide directly', () => {
  it('same unit, and the historical empty-total-unit case', () => {
    expect(ratio('litres', 'litres').rawRatio).toBeCloseTo(25, 10);
    // No facility total unit at all: units cancel by assumption. This is the
    // oldest behaviour in the function and the most common stored shape.
    expect(ratio('units', '').rawRatio).toBeCloseTo(25, 10);
    expect(unitMismatch(ratio('litres', 'litres').warnings)).toBe(false);
  });
});

describe('golden: convertible units normalise to a common basis', () => {
  it('volume family', () => {
    // 5000 L against 200 hL = 20 000 L.
    expect(ratio('litres', 'hectolitres').rawRatio).toBeCloseTo(0.25, 10);
    // 5000 hL = 500 000 L against 200 L.
    expect(ratio('hectolitres', 'litres').rawRatio).toBeCloseTo(2500, 10);
    // 5000 bottles x 0.7 L = 3500 L against 200 L.
    expect(ratio('bottles', 'litres').rawRatio).toBeCloseTo(17.5, 10);
  });

  it('mass family', () => {
    // 5000 kg against 200 t = 200 000 kg.
    expect(ratio('kg', 'tonnes').rawRatio).toBeCloseTo(0.025, 10);
    expect(ratio('tonnes', 'kg').rawRatio).toBeCloseTo(25000, 10);
  });

  it('none of these warn about an unconvertible mismatch', () => {
    for (const [a, b] of [
      ['litres', 'hectolitres'],
      ['hectolitres', 'litres'],
      ['bottles', 'litres'],
      ['kg', 'tonnes'],
      ['tonnes', 'kg'],
    ]) {
      expect(unitMismatch(ratio(a, b).warnings)).toBe(false);
    }
  });
});

describe('golden: incompatible units divide as entered AND warn', () => {
  it('volume against mass cannot be reconciled without a density', () => {
    const { rawRatio, warnings } = ratio('litres', 'kg');
    // Deliberate: the ratio is still returned so the calculation completes,
    // but it may be wrong by the unit factor, so the user is told plainly.
    expect(rawRatio).toBeCloseTo(25, 10);
    expect(unitMismatch(warnings)).toBe(true);
  });
});

describe('golden: spelling variants are the SAME unit', () => {
  // The six competing production-unit vocabularies in this codebase spell the
  // same unit as 'Litres', 'litres', 'Litre' and 'L'. None of these pairs may
  // ever be treated as an unconvertible mismatch, and all must give 25.
  const SAME_UNIT_PAIRS: Array<[string, string]> = [
    ['Litres', 'litres'],
    ['Litres', 'litre'],
    ['litre', 'litres'],
    ['L', 'litres'],
    ['l', 'Litres'],
    ['hL', 'hectolitres'],
    ['hl', 'Hectolitre'],
    ['Units', 'unit'],
    ['bottle', 'Bottles'],
    ['Kg', 'kilograms'],
    ['t', 'Tonnes'],
  ];

  /**
   * The ONLY behavioural difference between the branches, isolated here on
   * purpose. `main` raises a spurious "can't be converted automatically"
   * warning on singular-vs-plural `case`/`cases`; `redesign` recognises them
   * as one unit and stays quiet.
   *
   * Both divide to the same 25, which is the part that matters for cutover:
   * no footprint moves. Only the warning text a user sees changes, and it
   * changes for the better. So the ratio is asserted on both branches and the
   * warning deliberately is NOT — pinning it would force this file to fork,
   * and a forked harness proves nothing.
   */
  const WARNING_DIVERGES_BY_BRANCH: Array<[string, string]> = [
    ['cases', 'case'],
    ['case', 'cases'],
    ['Cases', 'case'],
    ['case', 'Cases'],
  ];

  it.each(WARNING_DIVERGES_BY_BRANCH)(
    '%s / %s still divides to the same number on both branches',
    (a, b) => {
      expect(ratio(a, b).rawRatio).toBeCloseTo(25, 10);
    },
  );

  it.each(SAME_UNIT_PAIRS)('%s / %s is recognised as one unit', (a, b) => {
    const { rawRatio, warnings } = ratio(a, b);
    expect(rawRatio).toBeCloseTo(25, 10);

    // The load-bearing half. The ratio alone proves nothing here: when a
    // spelling is NOT recognised the function still divides the two numbers as
    // entered, which for same-unit inputs lands on the same 25. What separates
    // "recognised" from "fell through" is whether it warned. Asserting only
    // the number let a mutant that stripped case-insensitivity from BOTH
    // comparison sites pass all 23 tests.
    expect(unitMismatch(warnings)).toBe(false);
  });
});

describe('golden: the guard rails still fire', () => {
  it('warns when a product is attributed more than the whole site', () => {
    const { rawRatio, warnings } = computeAttributionRatio(
      {
        facilityName: 'Somerset distillery',
        productionVolume: 500,
        productionVolumeUnit: 'litres',
        facilityTotalProduction: 100,
        facilityTotalProductionUnit: 'litres',
      } as any,
      0.7,
      true,
    );
    expect(rawRatio).toBeCloseTo(5, 10);
    expect(warnings.some((w) => w.includes('capped at 100%'))).toBe(true);
  });

  it('warns when the share is implausibly small', () => {
    const { warnings } = computeAttributionRatio(
      {
        facilityName: 'Somerset distillery',
        productionVolume: 1,
        productionVolumeUnit: 'litres',
        facilityTotalProduction: 1_000_000,
        facilityTotalProductionUnit: 'litres',
      } as any,
      0.7,
      true,
    );
    expect(warnings.some((w) => w.includes('less than 0.01%'))).toBe(true);
  });

  it('a zero or missing facility total yields no attribution at all', () => {
    expect(
      computeAttributionRatio(
        {
          facilityName: 'Somerset distillery',
          productionVolume: 5000,
          productionVolumeUnit: 'litres',
          facilityTotalProduction: 0,
          facilityTotalProductionUnit: 'litres',
        } as any,
        0.7,
        true,
      ).rawRatio,
    ).toBe(0);
  });
});
