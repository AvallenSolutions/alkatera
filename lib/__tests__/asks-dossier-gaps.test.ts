import { describe, it, expect } from 'vitest';
import {
  generateDossierBoundaryAsks,
  generateDossierDistributionAsks,
  BOUNDARY_CHOICES,
} from '@/lib/asks/generate';
import { priorityScore, sortByPriority, FALLBACK_IMPACT_TIER } from '@/lib/asks/impact';
import { isUntouchedDistributionDefault } from '@/lib/lca/dossier';

describe('the boundary ask', () => {
  const rows = [
    { pcfId: 'pcf-1', productId: '42', productName: 'Marine', systemBoundary: 'cradle-to-gate' },
  ];

  it('asks in plain language, with no ISO vocabulary in the question', () => {
    // The wizard put "System Boundary" and four cradle-to-X terms in front of
    // a founder at step three, before they had any way to know what the words
    // meant. The question a person reads must not contain them.
    const [ask] = generateDossierBoundaryAsks(rows);
    const text = `${ask.title} ${ask.payload.question}`.toLowerCase();
    expect(text).not.toContain('cradle');
    expect(text).not.toContain('system boundary');
    expect(text).not.toContain('functional unit');
    expect(text).toContain('how far');
  });

  it('offers the three real answers, keeping the ISO value underneath', () => {
    const [ask] = generateDossierBoundaryAsks(rows);
    expect(ask.payload.answer_shape).toBe('choice');
    expect(ask.payload.options).toEqual(BOUNDARY_CHOICES);
    // Labels are plain; values stay machine-readable for the calculator.
    expect(BOUNDARY_CHOICES.map((o) => o.label).join(' ')).not.toContain('cradle');
    expect(BOUNDARY_CHOICES.map((o) => o.value)).toContain('cradle-to-grave');
  });

  it('is stable across sweeps so it cannot pile up', () => {
    const [a] = generateDossierBoundaryAsks(rows);
    const [b] = generateDossierBoundaryAsks(rows);
    expect(a.payload.dedupe_key).toBe(b.payload.dedupe_key);
    expect(a.payload.dedupe_key).toBe('dossier_boundary:pcf-1');
  });

  it('sends the user to the dossier, not back into the wizard', () => {
    const [ask] = generateDossierBoundaryAsks(rows);
    expect(ask.payload.href).toBe('/products/42/dossier');
  });

  it('has no impact share, because the point is we do not know what is missing', () => {
    const [ask] = generateDossierBoundaryAsks(rows);
    expect(ask.payload.impact_share).toBeNull();
  });
});

describe('the distribution ask', () => {
  const rows = [
    { pcfId: 'pcf-1', productId: '42', productName: 'Marine', impactShare: 0.12 },
  ];

  it('says plainly that the 50 km figure is ours, not theirs', () => {
    const [ask] = generateDossierDistributionAsks(rows);
    expect(ask.payload.question).toContain('50 km');
    expect(ask.payload.question).toContain('standard starting point');
  });

  it('prefills the assumption it is asking about', () => {
    const [ask] = generateDossierDistributionAsks(rows);
    expect(ask.payload.answer_shape).toBe('number');
    expect(ask.payload.current_value).toBe(50);
    expect(ask.payload.unit).toBe('km');
  });

  it('carries its impact share so the queue can order by what it is worth', () => {
    const [ask] = generateDossierDistributionAsks(rows);
    expect(ask.payload.impact_share).toBe(0.12);
    expect(ask.payload.priority_score).toBe(0.12);
  });
});

describe('queue ordering', () => {
  it('puts a question worth 12% of the footprint above one with no share', () => {
    const withShare = generateDossierDistributionAsks([
      { pcfId: 'p1', productId: '1', productName: 'A', impactShare: 0.12 },
    ]);
    const withoutShare = generateDossierBoundaryAsks([
      { pcfId: 'p2', productId: '2', productName: 'B', systemBoundary: 'cradle-to-gate' },
    ]);
    const sorted = sortByPriority([...withoutShare, ...withShare]);
    expect(sorted[0].payload.ask_type).toBe('dossier_gap_distribution');
  });

  it('ranks an assumed boundary with the plausibility flags', () => {
    // A boundary that is wrong leaves whole stages uncounted, so it can be
    // wrong by more than any single figure inside the footprint.
    expect(FALLBACK_IMPACT_TIER.dossier_boundary).toBe(
      FALLBACK_IMPACT_TIER.plausibility_production_run,
    );
    expect(priorityScore('dossier_boundary', null)).toBeGreaterThan(
      priorityScore('growth_signal', null),
    );
  });

  it('gives every ask type a tier, so none can silently sort last', () => {
    for (const tier of Object.values(FALLBACK_IMPACT_TIER)) {
      expect(tier).toBeGreaterThan(0);
    }
  });
});

describe('isUntouchedDistributionDefault — one definition, shared', () => {
  const leg = (over: Record<string, unknown> = {}) => [
    { id: 'l1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 50, ...over },
  ];

  it('recognises the wizard default exactly', () => {
    expect(isUntouchedDistributionDefault(leg())).toBe(true);
  });

  it('does not fire once the distance has been touched', () => {
    expect(isUntouchedDistributionDefault(leg({ distanceKm: 240 }))).toBe(false);
  });

  it('does not fire on a different mode at the same distance', () => {
    expect(isUntouchedDistributionDefault(leg({ transportMode: 'ship' }))).toBe(false);
  });

  it('does not fire on a relabelled leg', () => {
    expect(isUntouchedDistributionDefault(leg({ label: 'Brewery to pub' }))).toBe(false);
  });

  it('does not fire on more than one leg', () => {
    expect(isUntouchedDistributionDefault([...leg(), ...leg()])).toBe(false);
  });

  it('handles nothing at all without throwing', () => {
    expect(isUntouchedDistributionDefault(null)).toBe(false);
    expect(isUntouchedDistributionDefault(undefined)).toBe(false);
    expect(isUntouchedDistributionDefault([])).toBe(false);
  });
});
