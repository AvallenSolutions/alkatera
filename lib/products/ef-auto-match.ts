// Deterministic emission factor auto-matching for the guided packaging
// wizard (and, later, other guided flows).
//
// Each catalogue entry carries an efSearchQuery; this helper runs it through
// the same ranked search the manual picker uses (/api/ingredients/search)
// and takes the top result, mapping it to the fields a PackagingFormData /
// product_materials row stores. If the search fails or returns nothing the
// row simply stays unmatched and the user can pick a factor manually.

import type { DataSource } from '@/lib/types/lca';
import { isFoodPackagingSystemName } from '@/lib/openlca/drinks-process-filter';

/**
 * Decide whether a search result is a confident enough packaging-material
 * match to attach automatically. Conservative on purpose: false rejections
 * just send the row to manual review, whereas false acceptances attach a
 * wrong factor (the "glass bottle → flavour oil" bug). Rejects:
 *  - food-product packaging systems ("<food> | Packaging System, …"),
 *  - Agribalyse results (a food database; its packaging is food-specific),
 *  - results that share no keyword with the query (clearly off-topic).
 */
export function isConfidentPackagingMatch(
  query: string,
  result: { name?: string; source_type?: string }
): boolean {
  const name = result?.name || '';
  if (!name) return false;
  if (isFoodPackagingSystemName(name)) return false;
  if (result.source_type === 'agribalyse_live') return false;

  const nameLower = name.toLowerCase();
  const queryWords = query.toLowerCase().split(/[\s,/()-]+/).filter((w) => w.length >= 3);
  if (queryWords.length === 0) return true;
  return queryWords.some((w) => wordAppearsIn(nameLower, w));
}

/** Substring check tolerant of simple plurals (apples -> apple, hops -> hop). */
function wordAppearsIn(haystackLower: string, word: string): boolean {
  if (haystackLower.includes(word)) return true;
  if (word.endsWith('s') && word.length >= 4 && haystackLower.includes(word.slice(0, -1))) return true;
  return false;
}

/**
 * Confidence gate for INGREDIENT auto-matches (checklist quick-adds, recipe
 * starters). Agribalyse is a strong source for food ingredients, so unlike
 * the packaging gate it is allowed; sub-process entries (heat, transport,
 * electricity "adapted for X") and off-topic names are rejected. False
 * rejections just leave the row for manual review.
 */
export function isConfidentIngredientMatch(
  query: string,
  result: { name?: string; source_type?: string }
): boolean {
  const name = result?.name || '';
  if (!name) return false;
  if (isFoodPackagingSystemName(name)) return false; // never an ingredient

  const nameLower = name.toLowerCase();
  const SUB_PROCESS_STARTS = ['heat,', 'heat production', 'transport,', 'transport ', 'electricity', 'lorry,', 'treatment of', 'waste '];
  if (SUB_PROCESS_STARTS.some((p) => nameLower.startsWith(p))) return false;
  if (nameLower.includes('adapted for') || nameLower.includes('- adapted')) return false;

  const queryWords = query.toLowerCase().split(/[\s,/()-]+/).filter((w) => w.length >= 3);
  if (queryWords.length === 0) return true;
  return queryWords.some((w) => wordAppearsIn(nameLower, w));
}

export interface EmissionFactorMatch {
  matched_source_name: string;
  data_source: DataSource;
  data_source_id?: string;
  supplier_product_id?: string;
  carbon_intensity?: number;
  openlca_database?: string;
  ef_source?: string;
  ef_source_type?: string;
  ef_data_quality_grade?: string;
  ef_uncertainty_percent?: number;
}

/**
 * Map a search result source_type to the DB-valid data_source value.
 * Mirrors the mapping in InlineIngredientSearch.handleResultSelect:
 * product_materials.data_source only allows 'openlca' | 'supplier' | NULL.
 */
export function sourceTypeToDataSource(sourceType?: string, supplierName?: string): DataSource {
  if (sourceType === 'primary') return 'supplier';
  if (sourceType) return 'openlca';
  return supplierName ? 'supplier' : 'openlca';
}

/**
 * Run a deterministic factor search and return the top-ranked match, or
 * null when nothing matched / the search errored. Never throws.
 */
export async function autoMatchEmissionFactor(input: {
  query: string;
  organizationId: string;
  /** Which kind of material this match is for; default packaging (wizard) */
  materialType?: 'ingredient' | 'packaging';
  packagingCategory?: string;
}): Promise<EmissionFactorMatch | null> {
  const materialType = input.materialType ?? 'packaging';
  try {
    // Imported lazily so this module stays loadable in environments without
    // Supabase env vars (the browser client throws at import time otherwise).
    const { supabase } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const params = new URLSearchParams({
      q: input.query,
      organization_id: input.organizationId,
      material_type: materialType,
    });
    if (input.packagingCategory) params.set('packaging_category', input.packagingCategory);

    const response = await fetch(`/api/ingredients/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result?.id) return null;

    // Confidence gate: under apply-and-flag, a wrong auto-match is worse than
    // no match (the user just picks manually). Reject the top result unless
    // we're confident it's a real packaging-material factor, returning null so
    // the wizard leaves the row needs_review.
    const isConfident = materialType === 'ingredient'
      ? isConfidentIngredientMatch(input.query, result)
      : isConfidentPackagingMatch(input.query, result);
    if (!isConfident) {
      return null;
    }

    return {
      matched_source_name: result.name,
      data_source: sourceTypeToDataSource(result.source_type, result.supplier_name),
      data_source_id: result.id,
      supplier_product_id: result.source_type === 'primary' ? result.id : undefined,
      carbon_intensity: result.co2_factor,
      openlca_database:
        result.source_type === 'agribalyse_live' ? 'agribalyse'
        : result.source_type === 'ecoinvent_live' ? 'ecoinvent'
        : undefined,
      ef_source: result.source || result.metadata?.source,
      ef_source_type: result.source_type,
      ef_data_quality_grade: result.data_quality_grade || result.metadata?.data_quality_grade,
      ef_uncertainty_percent: result.uncertainty_percent || result.metadata?.uncertainty_percent,
    };
  } catch (error) {
    console.warn('[ef-auto-match] Search failed, leaving row unmatched:', error);
    return null;
  }
}
