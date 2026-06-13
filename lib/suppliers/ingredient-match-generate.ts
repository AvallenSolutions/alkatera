import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rankIngredientMatches, type CandidateProduct } from './ingredient-matcher';

/**
 * Generate ingredient -> supplier-product match suggestions for an org.
 *
 * For every unlinked ingredient in the org's bills of materials, find the best
 * candidate among the org's linked suppliers' products (the same candidate
 * pool the manual linker uses) and upsert a suggestion. Suggest-only: a brand
 * reviews and accepts. Re-running is safe (unique key + ignoreDuplicates), so
 * accepted/dismissed verdicts are never resurfaced.
 *
 * Requires a service-role client: supplier_products are RLS-locked to the
 * supplier's own org, so the brand can only see them via a privileged read.
 */
export async function generateSuggestions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ created: number; materialsScanned: number }> {
  // 1. The org's products (for material scope + names on the suggestion).
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('organization_id', organizationId);
  const productIds = (products ?? []).map((p) => p.id);
  const productName = new Map((products ?? []).map((p) => [String(p.id), p.name as string]));
  if (productIds.length === 0) return { created: 0, materialsScanned: 0 };

  // 2. Unlinked ingredients across those products.
  const { data: materials } = await supabase
    .from('product_materials')
    .select('id, product_id, material_name, material_type, unit, supplier_product_id')
    .in('product_id', productIds)
    .eq('material_type', 'ingredient')
    .is('supplier_product_id', null);
  if (!materials || materials.length === 0) return { created: 0, materialsScanned: 0 };

  // 3. Candidate pool: ingredient products from the org's linked suppliers.
  const candidates = await fetchCandidatePool(supabase, organizationId);
  if (candidates.length === 0) return { created: 0, materialsScanned: materials.length };

  // 4. Score each ingredient, keep the single best candidate.
  const rows: Record<string, unknown>[] = [];
  for (const m of materials) {
    const best = rankIngredientMatches(
      { name: m.material_name as string, category: m.material_type as string, unit: m.unit as string },
      candidates,
      { limit: 1 },
    )[0];
    if (!best) continue;
    rows.push({
      organization_id: organizationId,
      product_id: m.product_id,
      product_material_id: m.id,
      supplier_product_id: best.candidate.id,
      supplier_product_table: best.candidate.table ?? 'supplier_products',
      ingredient_name: m.material_name,
      supplier_product_name: best.candidate.name,
      supplier_name: best.candidate.supplierName ?? null,
      match_confidence: Number(best.confidence.toFixed(3)),
      match_reason: best.reason,
      matched_by: best.matchedBy,
      status: 'suggested',
    });
  }

  if (rows.length === 0) return { created: 0, materialsScanned: materials.length };

  // 5. Upsert; the unique key keeps re-runs from clobbering decided rows.
  const { error } = await supabase
    .from('ingredient_match_suggestions')
    .upsert(rows, {
      onConflict: 'organization_id,product_material_id,supplier_product_id',
      ignoreDuplicates: true,
    });
  if (error) {
    console.error('[ingredient-match] upsert failed:', error.message);
    return { created: 0, materialsScanned: materials.length };
  }

  return { created: rows.length, materialsScanned: materials.length };
}

/**
 * The org's linked suppliers' ingredient products, shaped for the scorer.
 * Mirrors the resolution chain in app/api/suppliers/linked-products/route.ts
 * (organization_suppliers -> platform_suppliers email -> suppliers ->
 * supplier_products).
 */
async function fetchCandidatePool(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CandidateProduct[]> {
  const { data: orgSuppliers } = await supabase
    .from('organization_suppliers')
    .select('platform_supplier_id')
    .eq('organization_id', organizationId);
  const platformSupplierIds = (orgSuppliers ?? []).map((s) => s.platform_supplier_id).filter(Boolean);
  if (platformSupplierIds.length === 0) return [];

  const { data: platformSuppliers } = await supabase
    .from('platform_suppliers')
    .select('id, contact_email')
    .in('id', platformSupplierIds);
  const emails = (platformSuppliers ?? []).map((s) => s.contact_email).filter((e): e is string => !!e);
  if (emails.length === 0) return [];

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .in('contact_email', emails);
  const supplierIds = (suppliers ?? []).map((s) => s.id);
  const supplierName = new Map((suppliers ?? []).map((s) => [String(s.id), s.name as string]));
  if (supplierIds.length === 0) return [];

  const { data: sp } = await supabase
    .from('supplier_products')
    .select('id, name, product_type, unit, carbon_intensity, supplier_id')
    .in('supplier_id', supplierIds)
    .eq('is_active', true)
    .eq('product_type', 'ingredient');

  return (sp ?? []).map((p) => ({
    id: String(p.id),
    name: p.name as string,
    category: (p.product_type as string) ?? null,
    unit: (p.unit as string) ?? null,
    supplierName: supplierName.get(String(p.supplier_id)) ?? null,
    table: 'supplier_products' as const,
    carbonIntensity: (p.carbon_intensity as number) ?? null,
  }));
}
