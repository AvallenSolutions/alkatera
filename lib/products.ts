import { supabase } from './supabaseClient';
import type { Product, CreateProductInput, UpdateProductInput } from './types/products';

export async function fetchProducts(organizationId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function insertProduct(
  organizationId: string,
  input: CreateProductInput
): Promise<Product> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  if (!organizationId) {
    throw new Error('Organisation ID is required');
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('Error verifying organisation membership:', membershipError);
    throw new Error('Failed to verify organisation membership');
  }

  if (!membership) {
    throw new Error('You are not a member of this organisation');
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      organization_id: organizationId,
      name: input.name,
      sku: input.sku || null,
      product_category: input.product_category || null,
      unit_size_value: input.unit_size_value || null,
      unit_size_unit: input.unit_size_unit || null,
      product_description: input.product_description || null,
      product_image_url: input.product_image_url || null,
      certifications: input.certifications || [],
      awards: input.awards || [],
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting product:', error);
    if (error.message.includes('row-level security')) {
      throw new Error('Permission denied: Unable to create product for this organisation. Please ensure you have the correct permissions.');
    }
    throw new Error(error.message);
  }

  return data;
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  const { id, ...updateData } = input;

  const updatePayload: Record<string, any> = {};

  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.sku !== undefined) updatePayload.sku = updateData.sku || null;
  if (updateData.product_category !== undefined) {
    updatePayload.product_category = updateData.product_category || null;
  }
  if (updateData.unit_size_value !== undefined) {
    updatePayload.unit_size_value = updateData.unit_size_value || null;
  }
  if (updateData.unit_size_unit !== undefined) {
    updatePayload.unit_size_unit = updateData.unit_size_unit || null;
  }
  if (updateData.alcohol_content_abv !== undefined) {
    updatePayload.alcohol_content_abv = updateData.alcohol_content_abv ?? null;
  }
  // Keep legacy functional_unit text field in sync with structured fields
  if (updateData.unit_size_value !== undefined || updateData.unit_size_unit !== undefined) {
    const val = updateData.unit_size_value ?? updatePayload.unit_size_value;
    const unit = updateData.unit_size_unit ?? updatePayload.unit_size_unit;
    updatePayload.functional_unit = val && unit ? `${val} ${unit}` : null;
  }
  if (updateData.product_description !== undefined) {
    updatePayload.product_description = updateData.product_description || null;
  }
  if (updateData.product_image_url !== undefined) {
    updatePayload.product_image_url = updateData.product_image_url || null;
  }
  if (updateData.certifications !== undefined) {
    updatePayload.certifications = updateData.certifications || [];
  }
  if (updateData.awards !== undefined) {
    updatePayload.awards = updateData.awards || [];
  }

  const { data, error } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    throw new Error(error.message);
  }
}

/**
 * Duplicate a product: clones the product row plus its ingredients and
 * packaging (product_materials, including packaging component breakdowns).
 *
 * Deliberately NOT copied: production volumes, facility assignments,
 * production stages (so stage_id is cleared on copied ingredients),
 * passport settings, and any existing LCA reports. The copy is a fresh
 * recipe under a new name, ready to tweak for a sibling product.
 *
 * Returns the new product's id.
 */
export async function duplicateProduct(productId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: source, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();
  if (fetchError || !source) {
    throw new Error(fetchError?.message || 'Product not found');
  }

  // Copy descriptive fields; drop identifiers, timestamps, passport state,
  // production volumes and the completion flags for data that is not copied.
  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    passport_token: _ptoken,
    ...rest
  } = source as Record<string, any>;

  const productCopy: Record<string, any> = {
    ...rest,
    name: `${source.name} (copy)`,
    sku: null, // a SKU identifies one product; the copy needs its own
    created_by: user.id,
    is_draft: true,
    passport_enabled: false,
    annual_production_volume: null,
    core_operations_complete: false,
    downstream_distribution_complete: false,
    use_end_of_life_complete: false,
  };

  const { data: newProduct, error: insertError } = await supabase
    .from('products')
    .insert(productCopy)
    .select('id')
    .single();
  if (insertError || !newProduct) {
    throw new Error(insertError?.message || 'Failed to create the copy');
  }

  const { data: materials, error: materialsError } = await supabase
    .from('product_materials')
    .select('*')
    .eq('product_id', productId);
  if (materialsError) {
    throw new Error(`Copy created, but copying its materials failed: ${materialsError.message}`);
  }

  // Insert one material at a time so packaging component breakdowns can be
  // re-parented onto the correct new row. Recipes are small; this is fine.
  for (const material of materials || []) {
    const {
      id: oldMaterialId,
      created_at: _mCreated,
      updated_at: _mUpdated,
      ...materialRest
    } = material as Record<string, any>;

    const { data: newMaterial, error: matInsertError } = await supabase
      .from('product_materials')
      .insert({
        ...materialRest,
        product_id: newProduct.id,
        // Production stages are not copied, so a copied stage link would
        // point at the source product's chain.
        stage_id: null,
      })
      .select('id')
      .single();
    if (matInsertError || !newMaterial) {
      throw new Error(`Copy created, but material "${material.material_name}" failed to copy: ${matInsertError?.message}`);
    }

    if (material.has_component_breakdown) {
      const { data: components } = await supabase
        .from('packaging_material_components')
        .select('*')
        .eq('product_material_id', oldMaterialId);
      if (components && components.length > 0) {
        const componentCopies = components.map((c: Record<string, any>) => {
          const { id: _cId, created_at: _cCreated, updated_at: _cUpdated, ...cRest } = c;
          return { ...cRest, product_material_id: newMaterial.id };
        });
        const { error: compError } = await supabase
          .from('packaging_material_components')
          .insert(componentCopies);
        if (compError) {
          throw new Error(`Copy created, but packaging components for "${material.material_name}" failed to copy: ${compError.message}`);
        }
      }
    }
  }

  return newProduct.id;
}
