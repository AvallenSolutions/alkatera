import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FEATURE_MIN_TIER,
  BETA_FEATURES,
  EXCLUSIVE_LADDERS,
  TIER_NAMES,
  isBetaFeature,
  getRequiredTierForFeature,
  featuresForTier,
} from '../feature-catalog';

/**
 * These tests guard the single source of truth for subscription gating. They
 * intentionally fail loudly if the catalog drifts from the FeatureCode union or
 * if the generated DB arrays would change shape — both invariants that let the
 * UI (`hasFeature`) and the server (`check_feature_access`) agree by construction.
 */

// Pull the non-template members of the FeatureCode union straight from the hook
// source so the test breaks if a new code is added without cataloguing it.
function featureCodeUnion(): string[] {
  // vitest runs from the repo root; import.meta.url isn't a file: URL under vitest.
  const src = readFileSync(resolve(process.cwd(), 'hooks/useSubscription.ts'), 'utf8');
  // End the capture at the template-literal member so a stray `;` in a comment
  // inside the union doesn't truncate it.
  const block = src.match(/export type FeatureCode\s*=([\s\S]*?_integration_beta`;)/)![1];
  return Array.from(new Set([...block.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1])));
}

describe('feature-catalog: completeness', () => {
  it('every non-beta FeatureCode is mapped to a tier (so trusting the DB list never under-grants)', () => {
    const union = featureCodeUnion();
    const uncovered = union.filter(
      (code) => !(code in FEATURE_MIN_TIER) && !isBetaFeature(code as never)
    );
    expect(uncovered).toEqual([]);
  });

  it('no FEATURE_MIN_TIER key is a stale/typo code missing from the union', () => {
    const union = new Set(featureCodeUnion());
    const stale = Object.keys(FEATURE_MIN_TIER).filter((c) => !union.has(c));
    expect(stale).toEqual([]);
  });
});

describe('feature-catalog: tier generation', () => {
  it('produces the expected cumulative grant counts (matches the shipped DB arrays)', () => {
    expect(featuresForTier('seed')).toHaveLength(17);
    expect(featuresForTier('blossom')).toHaveLength(38);
    // 65 → 69 on 2026-07-24: viticulture, orchards, arable_fields and
    // hospitality left private beta and became canopy features.
    expect(featuresForTier('canopy')).toHaveLength(69);
  });

  it('is cumulative for non-ladder features: each tier is a superset of the one below', () => {
    // Exclusive-ladder variants are collapsed per tier (rosa_ai_25 → 100 → unlimited),
    // so they are excluded from the strict-superset invariant (see next test).
    const ladderCodes = new Set(EXCLUSIVE_LADDERS.flat());
    const nonLadder = (t: 'seed' | 'blossom' | 'canopy') =>
      featuresForTier(t).filter((c) => !ladderCodes.has(c));
    const blossom = new Set(nonLadder('blossom'));
    const canopy = new Set(nonLadder('canopy'));
    for (const c of nonLadder('seed')) expect(blossom.has(c)).toBe(true);
    for (const c of nonLadder('blossom')) expect(canopy.has(c)).toBe(true);
  });

  it('collapses exclusive ladders to a single highest variant per tier', () => {
    const rosaOf = (t: 'seed' | 'blossom' | 'canopy') =>
      featuresForTier(t).filter((c) => c.startsWith('rosa_ai_'));
    expect(rosaOf('seed')).toEqual(['rosa_ai_25']);
    expect(rosaOf('blossom')).toEqual(['rosa_ai_100']);
    expect(rosaOf('canopy')).toEqual(['rosa_ai_unlimited']);
  });

  it('treats greenwash codes as additive, not exclusive', () => {
    expect(featuresForTier('canopy').filter((c) => c.startsWith('greenwash_')).sort()).toEqual([
      'greenwash_documents',
      'greenwash_unlimited',
      'greenwash_website',
    ]);
  });
});

describe('feature-catalog: classification helpers', () => {
  it('isBetaFeature covers product betas and the integration-beta suffix', () => {
    for (const b of BETA_FEATURES) expect(isBetaFeature(b)).toBe(true);
    expect(isBetaFeature('breww_integration_beta')).toBe(true);
    expect(isBetaFeature('full_scope_3')).toBe(false);
  });

  it('getRequiredTierForFeature maps samples correctly; betas and unknowns have safe defaults', () => {
    expect(getRequiredTierForFeature('dashboard_vitality')).toBe('seed');
    expect(getRequiredTierForFeature('full_scope_3')).toBe('blossom');
    expect(getRequiredTierForFeature('governance_ethics')).toBe('canopy');
    expect(getRequiredTierForFeature('epr_beta')).toBe('canopy');
    // The four works-with modules are ordinary canopy features, not betas.
    expect(getRequiredTierForFeature('hospitality')).toBe('canopy');
    expect(getRequiredTierForFeature('viticulture')).toBe('canopy');
    expect(isBetaFeature('hospitality')).toBe(false);
    expect(getRequiredTierForFeature('totally_unknown_code' as never)).toBe('seed');
  });

  it('TIER_NAMES is ordered low-to-high', () => {
    expect(TIER_NAMES).toEqual(['seed', 'blossom', 'canopy']);
  });
});
