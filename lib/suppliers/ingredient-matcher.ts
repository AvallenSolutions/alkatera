// Score how well a bill-of-materials ingredient matches a supplier product,
// so a brand can link to supplier primary data (Priority 1 in the LCA
// waterfall) instead of a generic factor. Pure and unit-tested; reuses the
// name primitives from the Xero supplier matcher.

import { normaliseName, tokenOverlapScore } from '@/lib/xero/supplier-matcher';

export interface IngredientInput {
  name: string;
  category?: string | null;
  unit?: string | null;
}

export interface CandidateProduct {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  supplierName?: string | null;
  table?: 'supplier_products' | 'platform_supplier_products';
  carbonIntensity?: number | null;
}

export interface MatchScore {
  confidence: number;
  reason: string;
  matchedBy: string;
}

export interface RankedMatch extends MatchScore {
  candidate: CandidateProduct;
}

const CATEGORY_BOOST = 0.1;
const UNIT_BOOST = 0.05;
/** Suggestions below this are not worth a brand's time to review. */
export const DEFAULT_MIN_CONFIDENCE = 0.4;

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

/** Treat units as compatible when they normalise to the same token. */
function unitsCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Score one ingredient against one candidate supplier product. Confidence is
 * driven by name similarity, lifted slightly when category and unit agree
 * (only when there is already a name signal, so category alone can't promote
 * an unrelated product).
 */
export function scoreIngredientMatch(ingredient: IngredientInput, candidate: CandidateProduct): MatchScore {
  const nameScore = tokenOverlapScore(normaliseName(ingredient.name), normaliseName(candidate.name));

  if (nameScore <= 0) {
    return { confidence: 0, reason: 'No name overlap', matchedBy: 'none' };
  }

  const categoryAgrees = Boolean(norm(ingredient.category) && norm(ingredient.category) === norm(candidate.category));
  const unitAgrees = unitsCompatible(ingredient.unit, candidate.unit);

  let confidence = nameScore;
  const matchedParts: string[] = ['name'];
  const reasonParts: string[] = [`Name ${Math.round(nameScore * 100)}% similar`];

  if (categoryAgrees) {
    confidence += CATEGORY_BOOST;
    matchedParts.push('category');
    reasonParts.push('same category');
  }
  if (unitAgrees) {
    confidence += UNIT_BOOST;
    matchedParts.push('unit');
    reasonParts.push('matching unit');
  }

  return {
    confidence: Math.min(1, confidence),
    reason: reasonParts.join(', '),
    matchedBy: matchedParts.join('+'),
  };
}

/**
 * Rank candidates for an ingredient, best first, dropping anything below the
 * confidence floor. `limit` caps how many are returned (default 1: just the
 * best, which is what the review UI shows per ingredient).
 */
export function rankIngredientMatches(
  ingredient: IngredientInput,
  candidates: CandidateProduct[],
  opts: { min?: number; limit?: number } = {},
): RankedMatch[] {
  const min = opts.min ?? DEFAULT_MIN_CONFIDENCE;
  const limit = opts.limit ?? 1;
  return candidates
    .map((candidate) => ({ candidate, ...scoreIngredientMatch(ingredient, candidate) }))
    .filter((m) => m.confidence >= min)
    .sort((a, b) => b.confidence - a.confidence || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit);
}
