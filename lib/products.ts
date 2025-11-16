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
  if (updateData.unit_size_value !== undefined) {
    updatePayload.unit_size_value = updateData.unit_size_value || null;
  }
  if (updateData.unit_size_unit !== undefined) {
    updatePayload.unit_size_unit = updateData.unit_size_unit || null;
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
