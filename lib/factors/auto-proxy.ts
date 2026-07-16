// Deterministic "conservative stand-in" proxy selection for materials with
// no confident emission-factor match — the code-side half of "factor
// selection abolished as a user task" (tasks/data-revolution-plan.md,
// Pillar 2). Ingredients and packaging that fail the confidence gate in
// `lib/products/ef-auto-match.ts` (autoMatchEmissionFactor returns null)
// still need to compute; a user should never see an empty factor field.
//
// This is NOT an extraction of Rosa's `propose_apply_proxy` tool logic —
// that "logic" doesn't exist as code. Rosa picks a proxy by reasoning about
// the ingredient in conversation (lib/rosa/tools.ts's tool description asks
// the model for a name/source/confidence/justification); there is no
// deterministic algorithm behind it to extract. What IS reused here is the
// WRITE shape `execApplyProxy` (lib/rosa/actions.ts) settled on for a
// proxy — `ef_source_type: 'proxy'`, an uncertainty-from-confidence figure,
// a quality-grade band — so a proxy applied automatically here and one
// applied by Rosa in conversation look identical to every downstream reader
// (the impact waterfall, the provenance mappers, the admin factor queue).
//
// Selection policy, conservative on purpose (false "no match" is safe —
// the row just stays visible for review; a wrong confident match is not):
//   1. Take the top raw result from the same ranked search the manual
//      picker and `autoMatchEmissionFactor` use, even though it failed the
//      confidence gate — a loosely-related real factor beats no factor.
//   2. If the search returns nothing at all (empty query, brand-new
//      material name with zero token overlap anywhere), fall back to a
//      small, deliberately pessimistic per-category default so the record
//      still computes rather than silently reporting zero impact.
// Either way the uncertainty is floored high and the quality grade is
// pinned to LOW, so nothing downstream mistakes a proxy for a real match.

import { sourceTypeToDataSource, type EmissionFactorMatch } from '@/lib/products/ef-auto-match';

export interface ConservativeProxySearchResult {
  id?: string;
  name?: string;
  source_type?: string;
  co2_factor?: number;
  unit?: string;
  source?: string;
  supplier_name?: string;
  metadata?: { source?: string } | null;
}

export interface ConservativeProxyMatch extends EmissionFactorMatch {
  ef_source_type: 'proxy';
  /** Why this particular proxy was chosen — carried into the admin factor-queue payload. */
  proxy_reason: 'closest_search_result' | 'category_fallback';
}

/** Uncertainty floor for any auto-applied proxy — never claim more confidence than a human-reviewed proxy would carry. */
const PROXY_UNCERTAINTY_PERCENT = 45;

/**
 * Deliberately pessimistic per-category defaults, used only when the search
 * returns literally zero results (no staging factor, no live OpenLCA
 * process, nothing). Values are round-number, high-end literature
 * approximations (not tied to any one ingredient) — overstating a genuinely
 * unknown impact is safer than hiding it as zero. Always flagged 'estimated'
 * and always logged to the admin factor queue.
 */
const CATEGORY_FALLBACK: Record<'ingredient' | 'packaging', { name: string; co2Factor: number }> = {
  ingredient: { name: 'Average processed food ingredient (conservative default)', co2Factor: 2.5 },
  packaging: { name: 'Average mixed packaging material (conservative default)', co2Factor: 3.0 },
};

/**
 * Pure selector: given the same `/api/ingredients/search` results the
 * confidence gate already rejected, pick the closest reasonable stand-in.
 * Never returns null — always applies a proxy so the record computes.
 */
export function selectConservativeProxy(
  results: ConservativeProxySearchResult[],
  materialType: 'ingredient' | 'packaging',
): ConservativeProxyMatch {
  const top = results?.[0];
  if (top?.name) {
    return {
      matched_source_name: top.name,
      data_source: sourceTypeToDataSource(top.source_type, top.supplier_name),
      data_source_id: top.id,
      carbon_intensity: top.co2_factor,
      ef_source: top.source || top.metadata?.source,
      ef_source_type: 'proxy',
      ef_data_quality_grade: 'LOW',
      ef_uncertainty_percent: PROXY_UNCERTAINTY_PERCENT,
      proxy_reason: 'closest_search_result',
    };
  }

  const fallback = CATEGORY_FALLBACK[materialType];
  return {
    matched_source_name: fallback.name,
    data_source: 'openlca',
    carbon_intensity: fallback.co2Factor,
    ef_source: 'alkatera conservative default',
    ef_source_type: 'proxy',
    ef_data_quality_grade: 'LOW',
    ef_uncertainty_percent: 60,
    proxy_reason: 'category_fallback',
  };
}

/**
 * Client-safe end-to-end helper, mirroring `autoMatchEmissionFactor`'s own
 * fetch-then-decide shape (lib/products/ef-auto-match.ts) so a form can call
 * one after the other: try the confident match first, and only reach for
 * this when that returns null. Never throws — a search failure still
 * resolves to the category fallback so the caller always gets a usable
 * match.
 */
export async function autoApplyConservativeProxy(input: {
  query: string;
  organizationId: string;
  materialType?: 'ingredient' | 'packaging';
  packagingCategory?: string;
}): Promise<ConservativeProxyMatch> {
  const materialType = input.materialType ?? 'ingredient';
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return selectConservativeProxy([], materialType);

    const params = new URLSearchParams({
      q: input.query,
      organization_id: input.organizationId,
      material_type: materialType,
    });
    if (input.packagingCategory) params.set('packaging_category', input.packagingCategory);

    const response = await fetch(`/api/ingredients/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return selectConservativeProxy([], materialType);

    const data = await response.json();
    return selectConservativeProxy(data?.results || [], materialType);
  } catch (error) {
    console.warn('[auto-proxy] Search failed, applying the category fallback:', error);
    return selectConservativeProxy([], materialType);
  }
}
