import { supabase } from './supabaseClient';
import { getSupabaseServerClient } from './supabase/server-client';
import type { SimpleMaterialInput, ProductLcaMaterial, LcaStageWithSubStages } from './types/lca';

export async function createDraftLca(productId: string, organizationId: string) {
  try {
    console.log('[createDraftLca] Starting draft LCA creation', { productId, organizationId });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[createDraftLca] Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      console.error('[createDraftLca] No authenticated user found');
      throw new Error("User not authenticated");
    }

    console.log('[createDraftLca] User authenticated:', user.id);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, product_description, product_image_url, unit_size_value, unit_size_unit")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (productError) {
      console.error('[createDraftLca] Product fetch error:', productError);
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    if (!product) {
      console.error('[createDraftLca] Product not found', { productId, organizationId });
      throw new Error("Product not found or you don't have access to it");
    }

    console.log('[createDraftLca] Product fetched successfully:', product.name);

    const functionalUnit = product.unit_size_value && product.unit_size_unit
      ? `${product.unit_size_value} ${product.unit_size_unit}`
      : "1 unit";

    console.log('[createDraftLca] Functional unit determined:', functionalUnit);

    const lcaData = {
      organization_id: organizationId,
      product_id: productId,
      product_name: product.name,
      product_description: product.product_description || null,
      product_image_url: product.product_image_url || null,
      functional_unit: functionalUnit,
    };

    console.log('[createDraftLca] Inserting LCA with data:', lcaData);

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .insert(lcaData)
      .select()
      .single();

    if (lcaError) {
      console.error('[createDraftLca] LCA insert error:', lcaError);

      if (lcaError.code === '23502') {
        const match = lcaError.message.match(/column "([^"]+)"/);
        const column = match ? match[1] : 'unknown';
        throw new Error(`Missing required field: ${column}. Please ensure all product details are complete.`);
      }

      if (lcaError.code === '23503') {
        throw new Error("Invalid organisation or product reference. Please try again.");
      }

      if (lcaError.code === '42501') {
        throw new Error("Permission denied. You may not have access to create LCAs for this organisation.");
      }

      throw new Error(`Failed to create LCA: ${lcaError.message}`);
    }

    console.log('[createDraftLca] LCA created successfully:', lca.id);

    return { success: true, lcaId: lca.id };
  } catch (error) {
    console.error('[createDraftLca] Unexpected error:', error);
    const message = error instanceof Error ? error.message : "Failed to create draft LCA";
    return { success: false, error: message };
  }
}

export async function updateSourcingMethodology(
  lcaId: string,
  methodology: "GROWN" | "PURCHASED"
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("product_lcas")
      .update({ sourcing_methodology: methodology })
      .eq("id", lcaId);

    if (error) {
      throw new Error(`Failed to update sourcing methodology: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sourcing methodology";
    return { success: false, error: message };
  }
}

export async function fetchLcaStagesWithSubStages(): Promise<LcaStageWithSubStages[]> {
  const serverClient = getSupabaseServerClient();

  const { data: stages, error: stagesError } = await serverClient
    .from('lca_life_cycle_stages')
    .select('*')
    .order('display_order');

  if (stagesError) {
    throw new Error(`Failed to fetch LCA stages: ${stagesError.message}`);
  }

  const { data: subStages, error: subStagesError } = await serverClient
    .from('lca_sub_stages')
    .select('*')
    .order('display_order');

  if (subStagesError) {
    throw new Error(`Failed to fetch LCA sub-stages: ${subStagesError.message}`);
  }

  return (stages || []).map((stage) => ({
    ...stage,
    sub_stages: (subStages || []).filter((sub) => sub.lca_stage_id === stage.id),
  }));
}

export async function fetchLcaMaterials(lcaId: string): Promise<ProductLcaMaterial[]> {
  const serverClient = getSupabaseServerClient();

  console.log('[fetchLcaMaterials] Fetching materials for LCA:', lcaId);

  // Add timestamp to ensure fresh fetch - bypass any potential caching
  const timestamp = Date.now();
  console.log('[fetchLcaMaterials] Fetch timestamp:', timestamp);

  const { data, error } = await serverClient
    .from('product_lca_materials')
    .select('*')
    .eq('product_lca_id', lcaId)
    .order('created_at');

  if (error) {
    console.error('[fetchLcaMaterials] Error fetching materials:', error);
    throw new Error(`Failed to fetch materials: ${error.message}`);
  }

  console.log('[fetchLcaMaterials] Fetched materials:', data?.length || 0, data);
  return data || [];
}

export async function saveOrUpdateMaterials(
  lcaId: string,
  materials: SimpleMaterialInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[saveOrUpdateMaterials] Starting save', { lcaId, materialCount: materials.length, materials });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log('[saveOrUpdateMaterials] User authenticated:', user.id);

    const { data: lca, error: lcaError } = await supabase
      .from('product_lcas')
      .select('organization_id')
      .eq('id', lcaId)
      .maybeSingle();

    if (lcaError) {
      throw new Error(`Failed to verify LCA: ${lcaError.message}`);
    }

    if (!lca) {
      throw new Error("LCA not found");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', lca.organization_id)
      .maybeSingle();

    if (!membership) {
      throw new Error("Not authorized to modify this LCA");
    }

    const validationErrors: string[] = [];
    materials.forEach((material, index) => {
      if (!material.name || material.name.trim() === '') {
        validationErrors.push(`Material ${index + 1}: Name is required`);
      }

      const qty = typeof material.quantity === 'string' ? parseFloat(material.quantity) : material.quantity;
      if (isNaN(qty) || qty <= 0) {
        validationErrors.push(`Material ${index + 1}: Valid quantity is required`);
      }

      if (!material.unit || material.unit.trim() === '') {
        validationErrors.push(`Material ${index + 1}: Unit is required`);
      }

      if (!material.lca_sub_stage_id) {
        validationErrors.push(`Material ${index + 1}: Life cycle sub-stage is required`);
      }

      if (material.data_source === 'openlca' && !material.data_source_id) {
        validationErrors.push(`Material ${index + 1}: OpenLCA data source ID is required when data source is OpenLCA`);
      }

      if (material.data_source === 'supplier' && !material.supplier_product_id) {
        validationErrors.push(`Material ${index + 1}: Supplier product ID is required when data source is supplier network`);
      }
    });

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    const { error: deleteError } = await supabase
      .from('product_lca_materials')
      .delete()
      .eq('product_lca_id', lcaId);

    if (deleteError) {
      throw new Error(`Failed to delete existing materials: ${deleteError.message}`);
    }

    if (materials.length > 0) {
      const materialsToInsert = materials.map((material) => ({
        product_lca_id: lcaId,
        name: material.name,
        quantity: typeof material.quantity === 'string' ? parseFloat(material.quantity) : material.quantity,
        unit: material.unit,
        lca_sub_stage_id: material.lca_sub_stage_id,
        data_source: material.data_source || null,
        data_source_id: material.data_source_id || null,
        supplier_product_id: material.supplier_product_id || null,
        origin_country: material.origin_country || null,
        is_organic_certified: material.is_organic_certified || false,
      }));

      console.log('[saveOrUpdateMaterials] Inserting materials:', materialsToInsert);

      const { data: insertedData, error: insertError } = await supabase
        .from('product_lca_materials')
        .insert(materialsToInsert)
        .select();

      if (insertError) {
        console.error('[saveOrUpdateMaterials] Insert error:', insertError);
        throw new Error(`Failed to insert materials: ${insertError.message}`);
      }

      console.log('[saveOrUpdateMaterials] Successfully inserted:', insertedData);
    }

    console.log('[saveOrUpdateMaterials] Save completed successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save materials";
    return { success: false, error: message };
  }
}
