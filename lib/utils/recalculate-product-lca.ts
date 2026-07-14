import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { toValidAllocations } from '@/lib/utils/lca-recalc-allocations';

/**
 * Re-run a single product's LCA through the client-side calculator, faithfully
 * reusing its saved settings. Shared by the admin batch tool and the LCA report
 * page's "Recalculate" prompt so the two can't drift apart.
 *
 * Settings come from products.last_wizard_settings (boundary / reference year /
 * use-phase / EoL / distribution / loss configs). Facility allocations are
 * recovered from the most recent PCF that carries them in draft_data and mapped
 * exactly as the wizard's CalculationStep does (toValidAllocations).
 *
 * Returns 'skipped' (without calculating) when no facility allocations can be
 * recovered — recalculating with zero facility data would understate
 * processing/scope emissions, so those products must be re-run via the wizard.
 *
 * Also returns 'skipped' when the saved settings carry no system boundary.
 * Defaulting to cradle-to-gate here silently REPLACED a published
 * cradle-to-grave footprint with a gate-only one during batch repropagation —
 * the number shrank with no operator-visible diff. Products without a saved
 * boundary must be re-run via the wizard, where the user picks it explicitly.
 */
export type RecalcProduct = {
  id: number | string;
  name?: string | null;
  unit?: string | null;
  last_wizard_settings?: Record<string, any> | null;
};

export async function recalculateProductLca(
  sb: SupabaseClient,
  product: RecalcProduct,
  orgId: string,
): Promise<'done' | 'skipped'> {
  const settings = product.last_wizard_settings ?? {};
  if (!settings.systemBoundary) return 'skipped';

  const { data: pcfs } = await sb
    .from('product_carbon_footprints')
    .select('draft_data')
    .eq('product_id', product.id)
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(5);

  let validAllocations: any[] = [];
  for (const pcf of (pcfs ?? []) as Array<{ draft_data: any }>) {
    const allocs = toValidAllocations(pcf?.draft_data?.facilityAllocations);
    if (allocs.length > 0) { validAllocations = allocs; break; }
  }
  if (validAllocations.length === 0) return 'skipped';

  await calculateProductLCA({
    productId: String(product.id),
    functionalUnit: `1 ${product.unit || 'unit'} of ${product.name || 'product'}`,
    systemBoundary: settings.systemBoundary,
    referenceYear: settings.referenceYear,
    facilityAllocations: validAllocations,
    usePhaseConfig: settings.usePhaseConfig,
    eolConfig: settings.eolConfig,
    distributionConfig: settings.distributionConfig,
    productLossConfig: settings.productLossConfig,
  });
  return 'done';
}
