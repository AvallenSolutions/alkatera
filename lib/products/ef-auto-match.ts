// Deterministic emission factor auto-matching for the guided packaging
// wizard (and, later, other guided flows).
//
// Each catalogue entry carries an efSearchQuery; this helper runs it through
// the same ranked search the manual picker uses (/api/ingredients/search)
// and takes the top result, mapping it to the fields a PackagingFormData /
// product_materials row stores. If the search fails or returns nothing the
// row simply stays unmatched and the user can pick a factor manually.

import type { DataSource } from '@/lib/types/lca';

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
  packagingCategory?: string;
}): Promise<EmissionFactorMatch | null> {
  try {
    // Imported lazily so this module stays loadable in environments without
    // Supabase env vars (the browser client throws at import time otherwise).
    const { supabase } = await import('@/lib/supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const params = new URLSearchParams({
      q: input.query,
      organization_id: input.organizationId,
      material_type: 'packaging',
    });
    if (input.packagingCategory) params.set('packaging_category', input.packagingCategory);

    const response = await fetch(`/api/ingredients/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result?.id) return null;

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
