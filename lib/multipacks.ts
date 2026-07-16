import { supabase } from './supabaseClient';
import { boundaryToDbEnum } from './system-boundaries';
import { buildPackagingMaterialData } from './products/packaging-material-data';
import type { PackagingFormData } from '@/components/products/PackagingFormCard';
import type { PackagingCategory } from './types/lca';
import type {
  MultipackComponent,
  MultipackSecondaryPackaging,
  CreateMultipackComponentInput,
  UpdateMultipackComponentInput,
  CreateMultipackSecondaryPackagingInput,
  UpdateMultipackSecondaryPackagingInput,
  MultipackAggregatedData,
  Product,
} from './types/products';

// ============================================================================
// Multipack packaging → product_materials
// ============================================================================
// A multipack's own transit/grouping packaging lives on product_materials as
// ordinary packaging rows on the multipack product, exactly like a single SKU.
// That makes it visible to the Specification tab, the LCA calculator and EPR,
// and editable through the same machinery. (It used to live in the parallel,
// impoverished multipack_secondary_packaging table, read only by the Overview
// card.) These helpers build and read those rows.

export interface MultipackPackagingInput {
  material_name: string;
  material_type: string;
  /** Packaging role: the multipack's own packaging is transit/grouping, so
   *  shipment (courier), secondary (retail grouping) or tertiary (pallet). */
  packaging_category?: string;
  weight_grams: number;
  is_recyclable?: boolean;
  /** Empty string / undefined = unknown (saved as null); 0 = declared zero. */
  recycled_content_percentage?: number | "";
  notes?: string;
}

/**
 * Build a product_materials packaging row for one item of a multipack's own
 * packaging, reusing the single-SKU mapping (buildPackagingMaterialData) so
 * EPR level, allocation and circularity fields are populated identically.
 *
 * A multipack's own packaging is 1 per multipack unit, so units_per_group=1
 * (the multipack IS the sellable unit; its transit packaging is not shared
 * across several multipacks). Shared categories require units_per_group≥1 or
 * packagingFormErrors blocks the row — 1 satisfies that and is correct here.
 */
export function buildMultipackPackagingRow(
  pkg: MultipackPackagingInput,
  multipackProductId: string | number,
): Record<string, any> {
  const category = (pkg.packaging_category || 'shipment') as PackagingCategory;
  const form: PackagingFormData = {
    tempId: `mp-pkg-${multipackProductId}-${pkg.material_name}`,
    name: pkg.material_name,
    data_source: null,
    amount: '',
    unit: 'g',
    packaging_category: category,
    // Unknown stays unknown (null); an explicit 0 is a declared zero.
    recycled_content_percentage: pkg.recycled_content_percentage ?? '',
    printing_process: '',
    net_weight_g: pkg.weight_grams,
    origin_country: '',
    transport_mode: 'truck',
    distance_km: '',
    has_component_breakdown: false,
    components: [],
    epr_is_household: true,
    epr_is_drinks_container: false,
    units_per_group: 1,
    // The material the user picked ("Cardboard", "Plastic Film", "Wood") is
    // the row's material identity — dropping it forced end-of-life
    // classification back onto name inference ("Shrink Wrap" → 'other').
    container_material: pkg.material_type || null,
    // is_recyclable → recyclability_percent (all-or-nothing until the user
    // refines it in the packaging editor).
    recyclability_percent: (pkg.is_recyclable ?? true) ? 100 : 0,
  };
  const row = buildPackagingMaterialData(form, String(multipackProductId));
  // The builder has no notes mapping; carry the user's note onto the row.
  if (pkg.notes) row.notes = pkg.notes;
  return row;
}

/**
 * Fetch a multipack's own packaging as product_materials rows (material_type
 * 'packaging'). Used by the Overview card so Overview and Specification agree.
 */
export async function fetchMultipackPackagingMaterials(
  multipackProductId: string,
): Promise<any[]> {
  const { data, error } = await supabase
    .from('product_materials')
    .select('*')
    .eq('product_id', multipackProductId)
    .eq('material_type', 'packaging')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching multipack packaging materials:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Insert new packaging rows for a multipack's own packaging. Each item is built
 * through buildMultipackPackagingRow so the columns match the CREATE flow and
 * single-SKU packaging exactly (EPR level, material identity, allocation).
 */
export async function insertMultipackPackaging(
  multipackProductId: string,
  items: MultipackPackagingInput[],
): Promise<any[]> {
  if (items.length === 0) return [];
  const rows = items.map((item) => buildMultipackPackagingRow(item, multipackProductId));
  const { data, error } = await supabase
    .from('product_materials')
    .insert(rows)
    .select();

  if (error) {
    console.error('Error inserting multipack packaging materials:', error);
    throw new Error(error.message);
  }
  return data || [];
}

/**
 * Update one existing multipack packaging row. We rebuild the row through the
 * shared builder (so material identity, EPR level and allocation stay in lockstep
 * with the CREATE flow) but strip the fields that would clobber choices the user
 * may have made in the FULL packaging editor:
 *   - product_id: never move the row to another product.
 *   - epr_is_household / epr_is_drinks_container: the mini editor doesn't expose
 *     these, so leave whatever the full editor set.
 * epr_packaging_activity / epr_uk_nation / epr_ram_rating are absent from the
 * builder output entirely, so an update never touches them.
 */
export async function updateMultipackPackaging(
  rowId: string,
  item: MultipackPackagingInput,
  multipackProductId: string,
): Promise<void> {
  const row = buildMultipackPackagingRow(item, multipackProductId);
  delete row.product_id;
  delete row.epr_is_household;
  delete row.epr_is_drinks_container;

  const { error } = await supabase
    .from('product_materials')
    .update(row)
    .eq('id', rowId);

  if (error) {
    console.error('Error updating multipack packaging material:', error);
    throw new Error(error.message);
  }
}

/**
 * Delete multipack packaging rows by id.
 */
export async function deleteMultipackPackaging(rowIds: string[]): Promise<void> {
  if (rowIds.length === 0) return;
  const { error } = await supabase
    .from('product_materials')
    .delete()
    .in('id', rowIds);

  if (error) {
    console.error('Error deleting multipack packaging materials:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// Multipack Component Functions
// ============================================================================

export async function fetchMultipackComponents(
  multipackProductId: string
): Promise<MultipackComponent[]> {
  const { data, error } = await supabase
    .from('multipack_components')
    .select(`
      *,
      component_product:products!component_product_id (
        id,
        name,
        sku,
        product_category,
        unit_size_value,
        unit_size_unit,
        product_image_url,
        is_multipack,
        certifications,
        awards
      )
    `)
    .eq('multipack_product_id', multipackProductId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching multipack components:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function addMultipackComponent(
  input: CreateMultipackComponentInput
): Promise<MultipackComponent> {
  const { data, error } = await supabase
    .from('multipack_components')
    .insert({
      multipack_product_id: input.multipack_product_id,
      component_product_id: input.component_product_id,
      quantity: input.quantity,
    })
    .select(`
      *,
      component_product:products!component_product_id (
        id,
        name,
        sku,
        product_category,
        unit_size_value,
        unit_size_unit,
        product_image_url,
        is_multipack,
        certifications,
        awards
      )
    `)
    .single();

  if (error) {
    console.error('Error adding multipack component:', error);
    if (error.code === '23505') {
      throw new Error('This product is already added to the multipack');
    }
    throw new Error(error.message);
  }

  return data;
}

export async function updateMultipackComponent(
  input: UpdateMultipackComponentInput
): Promise<MultipackComponent> {
  const { id, ...updateData } = input;

  const { data, error } = await supabase
    .from('multipack_components')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      component_product:products!component_product_id (
        id,
        name,
        sku,
        product_category,
        unit_size_value,
        unit_size_unit,
        product_image_url,
        is_multipack,
        certifications,
        awards
      )
    `)
    .single();

  if (error) {
    console.error('Error updating multipack component:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function removeMultipackComponent(id: string): Promise<void> {
  const { error } = await supabase
    .from('multipack_components')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error removing multipack component:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// Multipack Secondary Packaging Functions
// ============================================================================

export async function fetchMultipackSecondaryPackaging(
  multipackProductId: string
): Promise<MultipackSecondaryPackaging[]> {
  const { data, error } = await supabase
    .from('multipack_secondary_packaging')
    .select('*')
    .eq('multipack_product_id', multipackProductId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching multipack secondary packaging:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function addMultipackSecondaryPackaging(
  input: CreateMultipackSecondaryPackagingInput
): Promise<MultipackSecondaryPackaging> {
  const { data, error } = await supabase
    .from('multipack_secondary_packaging')
    .insert({
      multipack_product_id: input.multipack_product_id,
      material_name: input.material_name,
      material_type: input.material_type,
      weight_grams: input.weight_grams,
      is_recyclable: input.is_recyclable ?? true,
      // Unknown stays null; the old `?? 0` recorded a declared 0% for unknowns.
      recycled_content_percentage:
        input.recycled_content_percentage == null || input.recycled_content_percentage === ''
          ? null
          : input.recycled_content_percentage,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding multipack secondary packaging:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateMultipackSecondaryPackaging(
  input: UpdateMultipackSecondaryPackagingInput
): Promise<MultipackSecondaryPackaging> {
  const { id, ...updateData } = input;

  const { data, error } = await supabase
    .from('multipack_secondary_packaging')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating multipack secondary packaging:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function removeMultipackSecondaryPackaging(id: string): Promise<void> {
  const { error } = await supabase
    .from('multipack_secondary_packaging')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error removing multipack secondary packaging:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// Aggregation Functions
// ============================================================================

export async function getMultipackAggregatedData(
  multipackProductId: string
): Promise<MultipackAggregatedData | null> {
  const { data, error } = await supabase
    .rpc('get_multipack_aggregated_data', { p_multipack_id: multipackProductId });

  if (error) {
    console.error('Error fetching multipack aggregated data:', error);
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

// ============================================================================
// Fetch Available Products for Multipack (completed, non-draft products)
// ============================================================================

export async function fetchAvailableProductsForMultipack(
  organizationId: string,
  excludeProductId?: string
): Promise<Product[]> {
  // Show the same products the main /products list shows: every real product
  // in the org. We deliberately do NOT filter on is_draft here — that flag is
  // overloaded (it doubles as the "archived" flag via the product page's
  // Archive action) and most products are created as drafts by the import,
  // Breww, onboarding and outreach flows, so filtering it out hid legitimately
  // set-up products (e.g. Everleaf's "Marine") from the multipack picker even
  // though they appear in the product list. product_kind keeps hospitality
  // meals/drinks/room-nights, which reuse the products table, out of the list.
  let query = supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_kind', 'product')
    // Archived products (archived_at set) are excluded — they should not be
    // pickable as new multipack components, matching the default product list.
    .is('archived_at', null)
    .order('name', { ascending: true });

  // Exclude the current multipack to prevent self-reference
  if (excludeProductId) {
    query = query.neq('id', excludeProductId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching available products for multipack:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// ============================================================================
// Create Complete Multipack (product + components + packaging in one transaction)
// ============================================================================

export interface CreateCompleteMultipackInput {
  organizationId: string;
  name: string;
  sku?: string;
  product_description?: string;
  product_category?: string;
  product_image_url?: string;
  system_boundary?: string;
  components: Array<{
    component_product_id: string;
    quantity: number;
  }>;
  secondaryPackaging?: MultipackPackagingInput[];
}

export async function createCompleteMultipack(
  input: CreateCompleteMultipackInput
): Promise<{ product: Product; components: MultipackComponent[]; packaging: any[] }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Every component must belong to the same organisation as the multipack.
  // Product ids are sequential integers, so without this check (and the
  // matching RLS component-org check) a crafted request could fold another
  // organisation's product name and footprint into this multipack.
  const componentIds = input.components.map((c) => c.component_product_id);
  if (componentIds.length > 0) {
    const { data: componentOrgs, error: componentOrgsError } = await supabase
      .from('products')
      .select('id, organization_id')
      .in('id', componentIds);
    if (componentOrgsError) {
      throw new Error(componentOrgsError.message);
    }
    const foundIds = new Set((componentOrgs || []).map((p) => p.id));
    const wrongOrg = (componentOrgs || []).filter(
      (p) => p.organization_id !== input.organizationId
    );
    const missing = componentIds.filter((id) => !foundIds.has(id));
    if (wrongOrg.length > 0 || missing.length > 0) {
      throw new Error('One or more selected products are not available to this organisation.');
    }
  }

  // First, create the multipack product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      sku: input.sku || null,
      product_description: input.product_description || null,
      product_category: input.product_category || null,
      product_image_url: input.product_image_url || null,
      // Let the column default ('cradle_to_gate') apply unless a caller passes
      // an explicit boundary. The enum uses underscores; the app uses hyphens,
      // so normalise through boundaryToDbEnum() like every other enum writer.
      ...(input.system_boundary ? { system_boundary: boundaryToDbEnum(input.system_boundary) } : {}),
      is_multipack: true,
      is_draft: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (productError) {
    console.error('Error creating multipack product:', productError);
    throw new Error(productError.message);
  }

  // Add components
  const componentsToInsert = input.components.map((comp) => ({
    multipack_product_id: product.id,
    component_product_id: comp.component_product_id,
    quantity: comp.quantity,
  }));

  const { data: components, error: componentsError } = await supabase
    .from('multipack_components')
    .insert(componentsToInsert)
    .select(`
      *,
      component_product:products!component_product_id (
        id,
        name,
        sku,
        product_category,
        unit_size_value,
        unit_size_unit,
        product_image_url,
        is_multipack,
        certifications,
        awards
      )
    `);

  if (componentsError) {
    // Rollback: delete the product if components fail
    await supabase.from('products').delete().eq('id', product.id);
    console.error('Error adding multipack components:', componentsError);
    throw new Error(componentsError.message);
  }

  // Add the multipack's own transit/grouping packaging as product_materials
  // packaging rows on the multipack product. This unifies multipacks with
  // single SKUs: the packaging is now visible to the Specification tab, the
  // LCA calculator and EPR, and editable through the same machinery.
  let packaging: any[] = [];
  if (input.secondaryPackaging && input.secondaryPackaging.length > 0) {
    const packagingToInsert = input.secondaryPackaging.map((pkg) =>
      buildMultipackPackagingRow(pkg, product.id)
    );

    const { data: packagingData, error: packagingError } = await supabase
      .from('product_materials')
      .insert(packagingToInsert)
      .select();

    if (packagingError) {
      // The packaging the user just described MUST reach the database — a
      // swallowed failure meant "Multipack created successfully" while the
      // shipper box was silently missing from the footprint. Roll back the
      // half-created multipack so the user can retry cleanly.
      console.error('Error adding multipack packaging materials:', packagingError);
      await supabase.from('multipack_components').delete().eq('multipack_product_id', product.id);
      await supabase.from('products').delete().eq('id', product.id);
      throw new Error(`Could not save the multipack's packaging: ${packagingError.message}`);
    }
    packaging = packagingData || [];
  }

  // Increment product count
  await supabase.rpc('increment_product_count', {
    p_organization_id: input.organizationId,
  });

  return {
    product,
    components: components || [],
    packaging,
  };
}

// ============================================================================
// Calculate Aggregated Certifications and Awards
// ============================================================================

export function aggregateCertificationsAndAwards(
  components: MultipackComponent[]
): { certifications: Array<{ name: string; evidence_url: string }>; awards: Array<{ name: string }> } {
  const certificationsMap = new Map<string, { name: string; evidence_url: string }>();
  const awardsMap = new Map<string, { name: string }>();

  for (const component of components) {
    const product = component.component_product;
    if (!product) continue;

    // Aggregate certifications (deduplicate by name)
    if (product.certifications) {
      for (const cert of product.certifications) {
        if (!certificationsMap.has(cert.name)) {
          certificationsMap.set(cert.name, cert);
        }
      }
    }

    // Aggregate awards (deduplicate by name)
    if (product.awards) {
      for (const award of product.awards) {
        if (!awardsMap.has(award.name)) {
          awardsMap.set(award.name, award);
        }
      }
    }
  }

  return {
    certifications: Array.from(certificationsMap.values()),
    awards: Array.from(awardsMap.values()),
  };
}
