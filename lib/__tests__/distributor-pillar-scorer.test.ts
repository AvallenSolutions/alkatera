import { describe, it, expect } from 'vitest';
import {
  scoreFromScrapedFields,
  scoreFromAlkateraComposite,
  tierForScore,
  weightedAvgSkippingNull,
  type FieldValue,
  type CategoryConfidence,
} from '@/lib/distributor/scoring/pillar-scorer';
import { scoreTarget } from '@/lib/distributor/scoring/target-scorer';
import { certScore } from '@/lib/distributor/scoring/certification-credibility';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';
import type { VitalityComposite } from '@/lib/vitality/composite';

function build(
  values: Record<string, { text: string; numeric: number | null }>,
): Map<FieldKey, FieldValue> {
  const map = new Map<FieldKey, FieldValue>();
  for (const [k, v] of Object.entries(values)) {
    map.set(k as FieldKey, { field_key: k as FieldKey, text: v.text, numeric: v.numeric });
  }
  return map;
}

const bool = (b: boolean) => ({ text: String(b), numeric: b ? 1 : 0 });
const n = (x: number) => ({ text: String(x), numeric: x });

function ctx(
  category: string | null,
  categoryConfidence: CategoryConfidence,
): { category: string | null; categoryConfidence: CategoryConfidence } {
  return { category, categoryConfidence };
}

describe('scoreFromScrapedFields — unified pillar model', () => {
  it('no data → all pillars null, insufficient, low confidence', () => {
    const r = scoreFromScrapedFields(new Map(), ctx(null, 'industry_default'));
    expect(r.overall).toBe(0);
    expect(r.tier).toBe('insufficient');
    expect(r.confidence).toBe('low');
    expect(r.by_pillar.climate).toBeNull();
    expect(r.by_pillar.water).toBeNull();
    expect(r.by_pillar.governance).toBeNull();
  });

  it('carbon-negative B Corp gin distillery → leader, high confidence', () => {
    const r = scoreFromScrapedFields(
      build({
        carbon_negative_claim: bool(true),
        bcorp_certified: bool(true),
        epd_published: bool(true),
        renewable_energy_percentage: n(100),
        water_usage_litres_per_litre: n(1.0),
        recycled_packaging_percentage: n(80),
      }),
      ctx('Gin', 'detected'),
    );
    expect(r.by_pillar.climate).toBe(100); // carbon-negative tops climate intensity
    expect(r.by_pillar.water).toBeGreaterThanOrEqual(90); // 1 L/L vs spirits 30 L/L benchmark
    expect(r.by_pillar.governance).not.toBeNull();
    expect(r.by_pillar.social).not.toBeNull();
    expect(r.tier).toBe('leader');
    expect(r.confidence).toBe('high'); // ≥4 pillars + category resolved
  });

  it('credits verified carbon-neutral / net-zero operations on climate', () => {
    // Nc'Nean case: "verified net zero (scope 1&2)" with no carbon-negative
    // claim and no future target year. Should score climate strongly.
    const r = scoreFromScrapedFields(
      build({
        carbon_neutral_operations: bool(true),
        organic_certified: bool(true),
        renewable_energy_percentage: n(100),
        recycled_packaging_percentage: n(100),
        bcorp_certified: bool(true),
      }),
      ctx('Whisky', 'detected'),
    );
    expect(r.by_pillar.climate).toBeGreaterThanOrEqual(90); // net-zero floor
    // Lower than a carbon-negative brand's 100.
    const negative = scoreFromScrapedFields(
      build({ carbon_negative_claim: bool(true) }),
      ctx('Whisky', 'detected'),
    );
    expect(negative.by_pillar.climate).toBe(100);
    expect(r.by_pillar.climate!).toBeLessThan(negative.by_pillar.climate!);
  });

  it('category adjustment: same intensity diverges by category', () => {
    const fields = build({ carbon_intensity_kgco2e_per_litre: n(2.0) });
    const asWhisky = scoreFromScrapedFields(fields, ctx('Whisky', 'declared'));
    const asBeer = scoreFromScrapedFields(fields, ctx('Beer & Cider', 'declared'));
    // 2.0 kgCO₂e/L is excellent for whisky (benchmark 3.8) but poor for
    // beer (benchmark 0.85). The category MUST move the score.
    expect(asWhisky.by_pillar.climate!).toBeGreaterThan(85);
    expect(asBeer.by_pillar.climate!).toBeLessThan(25);
    expect(asWhisky.overall).toBeGreaterThan(asBeer.overall);
  });

  it('unknown category falls back to the industry-average benchmark', () => {
    const r = scoreFromScrapedFields(
      build({
        carbon_intensity_kgco2e_per_litre: n(1.0), // == DEFAULT_BENCHMARK
        water_usage_litres_per_litre: n(4.0), // == DEFAULT_WATER_BENCHMARK
        bcorp_certified: bool(true),
      }),
      ctx(null, 'industry_default'),
    );
    // ratio 1.0 → at-benchmark → 70 on both intensity pillars.
    expect(r.by_pillar.climate).toBe(70);
    expect(r.by_pillar.water).toBe(70);
    // 4 pillars but category defaulted → capped at medium, never high.
    expect(r.confidence).toBe('medium');
  });

  it('a single strong pillar cannot become a Leader (coverage cap)', () => {
    // One data point — a perfect climate signal and nothing else. The
    // pillar math still reads 100, but the headline is capped because a
    // brand assessed on one dimension hasn't earned a tier.
    const r = scoreFromScrapedFields(
      build({ carbon_negative_claim: bool(true) }),
      ctx('Gin', 'detected'),
    );
    expect(r.by_pillar.climate).toBe(100);
    expect(r.environment).toBe(100); // pillar quality is unchanged…
    expect(r.overall).toBeLessThanOrEqual(29); // …but the headline is capped
    expect(r.tier).toBe('insufficient');
  });

  it('comprehensive evidence outranks a single strong data point', () => {
    // The Cincoro vs Nc'Nean case: one packaging field must not beat a
    // brand with data across five pillars.
    const onePoint = scoreFromScrapedFields(
      build({ packaging_primary_material: { text: 'glass', numeric: null } }),
      ctx('Tequila', 'detected'),
    );
    const comprehensive = scoreFromScrapedFields(
      build({
        bcorp_certified: bool(true),
        organic_certified: bool(true),
        renewable_energy_percentage: n(100),
        recycled_packaging_percentage: n(100),
        packaging_primary_material: { text: 'glass', numeric: null },
        sustainability_report_url: { text: 'https://x.com/r', numeric: null },
      }),
      ctx('Whisky', 'detected'),
    );
    expect(comprehensive.overall).toBeGreaterThan(onePoint.overall);
    expect(onePoint.tier).toBe('insufficient'); // 1 pillar → capped
  });

  it('Leader requires breadth: 2–3 pillars caps at progressing', () => {
    // Two strong pillars, nothing else → can't exceed the progressing band.
    const r = scoreFromScrapedFields(
      build({ carbon_negative_claim: bool(true), bcorp_certified: bool(true) }),
      ctx('Gin', 'detected'),
    );
    expect(r.overall).toBeLessThanOrEqual(69);
    expect(r.tier).not.toBe('leader');
  });
});

describe('scoreTarget — ambition × credibility', () => {
  it('steep, SBTi-validated, baselined target scores high', () => {
    const s = scoreTarget({
      interimReductionPct: 50,
      interimTargetYear: 2030,
      baselineYear: 2019,
      netZeroYear: null,
      sbtStatus: null,
      sbtiValidated: true,
    });
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(70);
  });

  it('bare net-zero-by-2050 claim scores low', () => {
    const s = scoreTarget({
      interimReductionPct: null,
      interimTargetYear: null,
      baselineYear: null,
      netZeroYear: 2050,
      sbtStatus: null,
      sbtiValidated: false,
    });
    expect(s).not.toBeNull();
    expect(s!).toBeLessThanOrEqual(20);
  });

  it('returns null when there is no target data at all', () => {
    expect(
      scoreTarget({
        interimReductionPct: null,
        interimTargetYear: null,
        baselineYear: null,
        netZeroYear: null,
        sbtStatus: null,
        sbtiValidated: false,
      }),
    ).toBeNull();
  });
});

describe('certScore — saturating credibility curve', () => {
  it('rewards breadth with diminishing returns', () => {
    const one = certScore([0.9])!;
    const two = certScore([0.9, 0.7])!;
    const three = certScore([0.9, 0.7, 0.7])!;
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
    expect(three).toBeGreaterThanOrEqual(90);
    // Each additional cert adds less than the previous one.
    expect(two - one).toBeGreaterThan(three - two);
  });

  it('returns null with no certs', () => {
    expect(certScore([])).toBeNull();
  });
});

describe('weightedAvgSkippingNull', () => {
  it('drops null parts and renormalises over the rest', () => {
    const skip = weightedAvgSkippingNull([
      { v: 80, w: 0.7 },
      { v: null, w: 0.12 },
      { v: 60, w: 0.18 },
    ]);
    // (80*0.7 + 60*0.18) / (0.7 + 0.18) = 66.8 / 0.88 ≈ 75.91
    expect(skip).toBeCloseTo(75.9, 1);
    // Treating the null as zero would give a materially lower 66.8.
    expect(skip!).toBeGreaterThan(66.8);
  });

  it('returns null when every part is null', () => {
    expect(weightedAvgSkippingNull([{ v: null, w: 1 }])).toBeNull();
  });
});

describe('scoreFromAlkateraComposite — pass-through + re-roll', () => {
  it('maps platform pillars across and lands on the unified scale', () => {
    const composite = {
      composite: 80,
      e: { score: 90, has_data: true, sub: { climate: 95, water: 85, circularity: 80, nature: 70 } },
      s: { score: 60, has_data: true, sub: {} },
      g: { score: 50, has_data: true, sub: {} },
    } as unknown as VitalityComposite;
    const r = scoreFromAlkateraComposite(composite);
    expect(r.by_pillar.climate).toBe(95);
    expect(r.by_pillar.water).toBe(85);
    expect(r.by_pillar.circularity).toBe(80);
    expect(r.by_pillar.nature).toBe(70);
    expect(r.by_pillar.social).toBe(60);
    expect(r.by_pillar.governance).toBe(50);
    expect(r.confidence).toBe('high');
    expect(r.evidence.source).toBe('alkatera');
    expect(r.tier).toBe('leader');
  });
});

describe('tierForScore — unified bands', () => {
  it('bands at 70 / 50 / 30', () => {
    expect(tierForScore(69.9)).toBe('progressing');
    expect(tierForScore(70)).toBe('leader');
    expect(tierForScore(50)).toBe('progressing');
    expect(tierForScore(30)).toBe('developing');
    expect(tierForScore(29.9)).toBe('insufficient');
  });
});
