import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCategoryByValue } from '@/lib/product-categories';
import { getDefaultDistributionConfig, DISTRIBUTION_SCENARIOS } from '@/lib/distribution-factors';
import { boundaryToDbEnum } from '@/lib/system-boundaries';
import { inngest } from '@/lib/inngest/client';

/**
 * Every product is born with a footprint.
 *
 * Before this, a product sat at zero until somebody walked the wizard. The
 * cellar showed a blank where a number should be, and the first thing the
 * platform ever said about a new product was "there is nothing here". Getting
 * to a first number cost 45 to 55 actions.
 *
 * Now the moment a product has a recipe it gets an estimated footprint,
 * calculated from what we already know and labelled honestly as an estimate
 * throughout. The user's job becomes correcting it, which the ask queue
 * arranges one question at a time, biggest first.
 *
 * Nothing here is presented as fact. The boundary is recorded as 'defaulted'
 * so it raises a confirmation ask; the distribution leg is the standard 50 km
 * which the dossier flags as unchecked and the sweep turns into a question.
 * The estimate informs the cellar and the forest; it cannot reach a signed
 * report, which the confirmed-share gate enforces separately.
 */

/**
 * How far a footprint should follow a product, proposed from its category.
 *
 * A finished drink is sold, carried, chilled and thrown away, and a footprint
 * that stops at the factory gate hides most of that. The wider default gives a
 * bigger, truer starting number. It is always proposed, never assumed silently:
 * boundary_source stays 'defaulted' until a person answers the ask.
 */
export function defaultBoundaryForCategory(category: string | null | undefined): string {
  if (!category) return 'cradle-to-gate';
  const known = getCategoryByValue(category);
  const group = known?.group ?? category;

  // Anything a person opens and drinks: follow it the whole way.
  const consumerGroups = ['Spirits', 'Wine', 'Beer & Cider', 'Non-Alcoholic', 'Ready-to-Drink & Cocktails'];
  if (consumerGroups.includes(group)) return 'cradle-to-grave';

  // Everything else (ingredients, B2B, services, accommodation) stops at the
  // gate, because we cannot honestly guess what happens downstream.
  return 'cradle-to-gate';
}

/**
 * A starting distribution assumption, so a cradle-to-grave estimate has
 * something to compute rather than a silent zero. Always the plain local
 * scenario: an invented export route would be a bigger lie than a small one.
 */
function startingDistribution(productWeightKg: number) {
  const config = getDefaultDistributionConfig(productWeightKg);
  return config;
}

export interface FirstFootprintResult {
  productId: string;
  created: boolean;
  dispatched: boolean;
  reason?: string;
}

/**
 * Give one product an estimated footprint, if it has a recipe and no footprint
 * at all. Returns without acting when either is untrue: this must be safe to
 * call from any intake path, repeatedly.
 */
export async function ensureFirstFootprint(
  db: SupabaseClient,
  organizationId: string,
  productId: string | number,
  userId: string | null,
  baseUrl: string | null,
): Promise<FirstFootprintResult> {
  const id = String(productId);

  const { data: product } = await db
    .from('products')
    .select('id, name, unit, product_category, organization_id, last_wizard_settings')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!product) return { productId: id, created: false, dispatched: false, reason: 'not found' };

  // Already has a footprint of any kind: leave it entirely alone. Creating a
  // second one would race the active-PCF unique index and confuse history.
  const { count: pcfCount } = await db
    .from('product_carbon_footprints')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((pcfCount ?? 0) > 0) {
    return { productId: id, created: false, dispatched: false, reason: 'already has a footprint' };
  }

  // No recipe yet: there is genuinely nothing to estimate from, and inventing
  // a number here would be fabrication rather than estimation.
  const { data: materials } = await db
    .from('product_materials')
    .select('id, quantity, unit, material_type')
    .eq('product_id', productId)
    .limit(200);
  if (!materials || materials.length === 0) {
    return { productId: id, created: false, dispatched: false, reason: 'no recipe yet' };
  }

  const boundary = defaultBoundaryForCategory(product.product_category);

  // Rough shipped weight from the recipe, only to size the distribution leg.
  const weightKg = materials.reduce((sum: number, m: any) => {
    const q = Number(m.quantity) || 0;
    const unit = String(m.unit || '').toLowerCase();
    if (unit === 'kg') return sum + q;
    if (unit === 'g') return sum + q / 1000;
    return sum;
  }, 0);

  const settings = {
    ...((product.last_wizard_settings as any) ?? {}),
    systemBoundary: boundary,
    referenceYear: new Date().getFullYear(),
    distributionConfig: startingDistribution(weightKg > 0 ? weightKg : 1),
  };

  const { data: pcf, error: insertError } = await db
    .from('product_carbon_footprints')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      product_name: product.name,
      functional_unit: `1 ${product.unit || 'unit'} of ${product.name}`,
      system_boundary: boundary,
      // The whole point: proposed by us, so it raises a question rather than
      // passing as a decision somebody made.
      boundary_source: 'defaulted',
      reference_year: settings.referenceYear,
      lca_version: '1.0',
      lca_scope_type: boundary,
      distribution_config: settings.distributionConfig,
      status: 'estimate',
    })
    .select('id')
    .single();

  if (insertError || !pcf) {
    return {
      productId: id,
      created: false,
      dispatched: false,
      reason: insertError?.message || 'could not create the footprint',
    };
  }

  // Mirror the settings so any later recalculation uses the same assumptions
  // rather than silently reverting to the wizard's defaults.
  await db.from('products').update({
    last_wizard_settings: settings,
    system_boundary: boundaryToDbEnum(boundary),
  }).eq('id', productId);

  if (!baseUrl || !process.env.INNGEST_EVENT_KEY) {
    return {
      productId: id,
      created: true,
      dispatched: false,
      reason: 'background calculation is not configured here',
    };
  }

  const { data: run } = await db
    .from('lca_calculation_runs')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      requested_by: userId,
      trigger: 'first_recipe',
      status: 'queued',
    })
    .select('id')
    .single();

  if (!run) return { productId: id, created: true, dispatched: false, reason: 'could not record the run' };

  await inngest.send({
    name: 'lca/recalc.requested',
    data: { run_id: run.id, base_url: baseUrl },
  });

  return { productId: id, created: true, dispatched: true };
}

/**
 * Sweep an organisation: every product that has a recipe and no footprint gets
 * one. Runs alongside the ask sweep in the footprint agent, so a product that
 * arrived through any intake route is picked up even if that route never
 * called ensureFirstFootprint directly.
 */
export async function sweepFirstFootprints(
  db: SupabaseClient,
  organizationId: string,
  baseUrl: string | null,
  limit = 25,
): Promise<{ considered: number; created: number; dispatched: number }> {
  const { data: products } = await db
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(500);

  if (!products || products.length === 0) return { considered: 0, created: 0, dispatched: 0 };

  const { data: withPcf } = await db
    .from('product_carbon_footprints')
    .select('product_id')
    .eq('organization_id', organizationId);
  const has = new Set((withPcf ?? []).map((r: any) => String(r.product_id)));

  const candidates = products.filter((p: any) => !has.has(String(p.id))).slice(0, limit);

  let created = 0;
  let dispatched = 0;
  for (const p of candidates) {
    const result = await ensureFirstFootprint(db, organizationId, (p as any).id, null, baseUrl);
    if (result.created) created += 1;
    if (result.dispatched) dispatched += 1;
  }

  return { considered: candidates.length, created, dispatched };
}
