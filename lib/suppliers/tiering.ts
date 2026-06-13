// Supplier tier suggestion from spend materiality.
//
// B Corp expects you to identify and engage your significant direct
// suppliers. The pragmatic, defensible cut is spend: the suppliers that make
// up the bulk of what you pay are the ones that matter. We rank by spend and
// mark the cumulative top 80% as Tier 1 (direct, material); the long tail is
// left untiered so the survey list and the B Corp coverage denominator stay
// focused. Pure and unit-tested; the API supplies the spend numbers.

export type SupplierTier = 'tier_1' | 'tier_2' | 'tier_3';

/** Cumulative share of spend that defines the material (Tier 1) set. */
export const TIER1_SPEND_SHARE = 0.8;

export interface TierInputRow {
  id: string;
  spend: number | null | undefined;
  currentTier?: SupplierTier | null;
}

export interface TierSuggestion {
  id: string;
  spend: number;
  currentTier: SupplierTier | null;
  suggestedTier: SupplierTier | null;
  /** Cumulative share of total spend up to and including this supplier (0-1). */
  cumulativePct: number;
}

/**
 * Suggest tiers by spend materiality. Suppliers are ranked by spend
 * descending; each is Tier 1 while the running cumulative share is at or
 * below TIER1_SPEND_SHARE, so the supplier that crosses the threshold is
 * still included (you can't be "80% covered" without the one that tips you
 * over). Everything below is left untiered (null). Suppliers with zero or
 * missing spend are never Tier 1.
 */
export function suggestTiers(rows: TierInputRow[]): TierSuggestion[] {
  const normalised = rows.map((r) => ({
    id: r.id,
    spend: Number(r.spend) || 0,
    currentTier: r.currentTier ?? null,
  }));

  const totalSpend = normalised.reduce((sum, r) => sum + Math.max(0, r.spend), 0);

  // Rank by spend desc; stable tie-break on id so results are deterministic.
  const ranked = [...normalised].sort((a, b) => b.spend - a.spend || a.id.localeCompare(b.id));

  let cumulative = 0;
  let crossed = false; // true once we've included the supplier that reaches the threshold
  return ranked.map((r) => {
    cumulative += Math.max(0, r.spend);
    const cumulativePct = totalSpend > 0 ? cumulative / totalSpend : 0;

    let suggestedTier: SupplierTier | null = null;
    if (totalSpend > 0 && r.spend > 0 && !crossed) {
      suggestedTier = 'tier_1';
      if (cumulativePct >= TIER1_SPEND_SHARE) crossed = true; // this one tips us over; stop after it
    }

    return {
      id: r.id,
      spend: r.spend,
      currentTier: r.currentTier,
      suggestedTier,
      cumulativePct,
    };
  });
}

/** Count and spend share of the suggested Tier 1 set, for the review summary. */
export function tier1Summary(suggestions: TierSuggestion[]): { count: number; spendSharePct: number } {
  const tier1 = suggestions.filter((s) => s.suggestedTier === 'tier_1');
  const total = suggestions.reduce((sum, s) => sum + Math.max(0, s.spend), 0);
  const tier1Spend = tier1.reduce((sum, s) => sum + Math.max(0, s.spend), 0);
  return {
    count: tier1.length,
    spendSharePct: total > 0 ? (tier1Spend / total) * 100 : 0,
  };
}
