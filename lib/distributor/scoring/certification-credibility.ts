import type { FieldKey } from '../scraping/field-definitions';

/**
 * Credibility-weighted certification scoring.
 *
 * Not all certifications are equal evidence. A third-party-audited,
 * product-level declaration (an EPD, an SBTi-validated target) is much
 * stronger proof of a sustainability claim than a self-declared status.
 * Each recognised certification therefore carries a credibility weight
 * in [0, 1] reflecting how strong a signal it is. The weights echo the
 * canonical `certification_frameworks` table on the main platform.
 *
 * A pillar's certification sub-score is a *saturating* function of the
 * summed credibility of the certs the brand holds in that pillar:
 *
 *     score = 100 · (1 − e^(−k · Σweight))      (k = 1.2)
 *
 * This gives diminishing returns — one strong cert already earns a solid
 * score, a second adds less, a third less again — so breadth is rewarded
 * without letting a brand stack near-identical badges to a perfect 100.
 *
 *     Σweight 0.9 (one B Corp)        → ~66
 *     Σweight 1.8 (B Corp + ISO)      → ~88
 *     Σweight 2.7 (three certs)       → ~96
 */

/** Credibility weight per certification-style field. Higher = stronger evidence. */
export const CERT_CREDIBILITY: Partial<Record<FieldKey, number>> = {
  // Climate
  sbti_validated: 1.0, // independently validated target — the gold standard
  epd_published: 0.9, // third-party verified product LCA
  carbon_trust_certified: 0.8,
  cdr_partnership: 0.7, // permanent removals, not offsets
  // Nature / sourcing
  rainforest_alliance_certified: 0.8,
  organic_certified: 0.7,
  // Social
  fairtrade_certified: 0.8,
  bcorp_certified: 0.9, // holistic, audited
  // Governance / management systems
  iso_14001_certified: 0.7,
  iso_50001_certified: 0.7,
};

/** Default credibility for a cert field with no explicit weight. */
const DEFAULT_CREDIBILITY = 0.5;

/** Saturation coefficient — see module docstring. */
const SATURATION_K = 1.2;

/**
 * Map a set of credibility weights to a 0–100 sub-score via the
 * saturating curve. Returns null when no certs are present so the
 * caller can redistribute weight rather than scoring a hard zero.
 */
export function certScore(weights: number[]): number | null {
  if (weights.length === 0) return null;
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  return Math.round(100 * (1 - Math.exp(-SATURATION_K * sum)));
}

/**
 * Certification sub-score for the given certification fields, using the
 * provided truth-test to decide which the brand holds. Only fields the
 * brand actually holds contribute; absent / false certs are ignored
 * (returns null when none are held).
 */
export function certScoreForFields(
  keys: FieldKey[],
  isTrue: (key: FieldKey) => boolean,
): number | null {
  const weights = keys
    .filter((k) => isTrue(k))
    .map((k) => CERT_CREDIBILITY[k] ?? DEFAULT_CREDIBILITY);
  return certScore(weights);
}
