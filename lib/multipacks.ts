import { supabase } from './supabaseClient';
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
      recycled_content_percentage: input.recycled_content_percentage ?? 0,
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
  let query = supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_draft', false)
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
  secondaryPackaging?: Array<{
    material_name: string;
    material_type: string;
    weight_grams: number;
    is_recyclable?: boolean;
    recycled_content_percentage?: number;
    notes?: string;
  }>;
}

export async function createCompleteMultipack(
  input: CreateCompleteMultipackInput
): Promise<{ product: Product; components: MultipackComponent[]; packaging: MultipackSecondaryPackaging[] }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
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
      system_boundary: input.system_boundary || 'cradle_to_gate',
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

  // Add secondary packaging if provided
  let packaging: MultipackSecondaryPackaging[] = [];
  if (input.secondaryPackaging && input.secondaryPackaging.length > 0) {
    const packagingToInsert = input.secondaryPackaging.map((pkg) => ({
      multipack_product_id: product.id,
      material_name: pkg.material_name,
      material_type: pkg.material_type,
      weight_grams: pkg.weight_grams,
      is_recyclable: pkg.is_recyclable ?? true,
      recycled_content_percentage: pkg.recycled_content_percentage ?? 0,
      notes: pkg.notes || null,
    }));

    const { data: packagingData, error: packagingError } = await supabase
      .from('multipack_secondary_packaging')
      .insert(packagingToInsert)
      .select();

    if (packagingError) {
      console.error('Error adding multipack secondary packaging:', packagingError);
      // Continue without packaging - not critical
    } else {
      packaging = packagingData || [];
    }
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
