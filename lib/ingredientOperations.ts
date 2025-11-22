import { supabase } from './supabaseClient';
import { saveDraftData, markTabComplete } from './lcaWorkflow';
import type { DataSource } from './types/lca';

export interface AddIngredientParams {
  lcaId: string;
  organizationId: string;
  ingredient: {
    name: string;
    quantity: number;
    unit: string;
    lca_sub_stage_id: string | null;
    data_source: DataSource;
    data_source_id?: string;
    supplier_product_id?: string;
    supplier_name?: string;
    origin_country?: string;
    is_organic_certified: boolean;
  };
}

export interface UpdateIngredientParams {
  materialId: string;
  lcaId: string;
  organizationId: string;
  updates: {
    quantity?: number;
    unit?: string;
    lca_sub_stage_id?: number;
    origin_country?: string;
    is_organic_certified?: boolean;
  };
}

export interface IngredientMaterial {
  id: string;
  product_lca_id: string;
  name: string;
  quantity: number;
  unit: string;
  lca_sub_stage_id: number | null;
  data_source: DataSource | null;
  data_source_id: string | null;
  supplier_product_id: string | null;
  supplier_name?: string;
  origin_country: string | null;
  is_organic_certified: boolean;
  created_at: string;
  updated_at: string;
}

export async function addIngredientToLCA(params: AddIngredientParams) {
  console.log('[addIngredientToLCA] Called with params:', params);
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[addIngredientToLCA] Auth error:', authError);
      throw new Error("User not authenticated");
    }

    console.log('[addIngredientToLCA] User authenticated:', user.id);

    const { data: lca, error: lcaError } = await supabase
      .from('product_lcas')
      .select('organization_id')
      .eq('id', params.lcaId)
      .single();

    if (lcaError || !lca) {
      throw new Error("LCA not found");
    }

    if (lca.organization_id !== params.organizationId) {
      throw new Error("LCA does not belong to specified organization");
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Membership verification failed: ${membershipError.message}`);
    }

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const materialData: any = {
      product_lca_id: params.lcaId,
      name: params.ingredient.name,
      quantity: params.ingredient.quantity,
      unit: params.ingredient.unit,
      lca_sub_stage_id: params.ingredient.lca_sub_stage_id,
      data_source: params.ingredient.data_source,
      data_source_id: params.ingredient.data_source_id || null,
      supplier_product_id: params.ingredient.supplier_product_id || null,
      origin_country: params.ingredient.origin_country || null,
      is_organic_certified: params.ingredient.is_organic_certified,
    };

    console.log('[addIngredientToLCA] Inserting material:', materialData);

    const { data, error } = await supabase
      .from('product_lca_materials')
      .insert(materialData)
      .select()
      .single();

    if (error) {
      console.error('[addIngredientToLCA] Insert error:', error);
      throw new Error(`Failed to add ingredient: ${error.message}`);
    }

    console.log('[addIngredientToLCA] Insert successful:', data);

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', params.lcaId);

    const enrichedMaterial = {
      ...data,
      supplier_name: params.ingredient.supplier_name,
    };

    await saveDraftData(params.lcaId, 'ingredients', existingMaterials || []);

    console.log('[ingredientOperations] Added ingredient:', {
      ingredientId: data.id,
      name: params.ingredient.name,
      source: params.ingredient.data_source,
    });

    return { success: true, ingredientId: data.id, ingredient: enrichedMaterial };
  } catch (error) {
    console.error('[addIngredientToLCA] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to add ingredient";
    return { success: false, error: message };
  }
}

export async function updateIngredient(params: UpdateIngredientParams) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: material, error: materialError } = await supabase
      .from('product_lca_materials')
      .select(`
        *,
        product_lcas!inner(organization_id)
      `)
      .eq('id', params.materialId)
      .single();

    if (materialError || !material) {
      throw new Error("Ingredient not found");
    }

    const orgId = (material as any).product_lcas.organization_id;

    if (orgId !== params.organizationId) {
      throw new Error("Ingredient does not belong to specified organization");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', params.organizationId)
      .maybeSingle();

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const { data, error } = await supabase
      .from('product_lca_materials')
      .update({
        ...params.updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.materialId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ingredient: ${error.message}`);
    }

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', params.lcaId);

    await saveDraftData(params.lcaId, 'ingredients', existingMaterials || []);

    console.log('[ingredientOperations] Updated ingredient:', {
      ingredientId: params.materialId,
      updates: Object.keys(params.updates),
    });

    return { success: true, ingredient: data };
  } catch (error) {
    console.error('[updateIngredient] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to update ingredient";
    return { success: false, error: message };
  }
}

export async function removeIngredient(materialId: string, lcaId: string, organizationId: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: material, error: materialError } = await supabase
      .from('product_lca_materials')
      .select(`
        *,
        product_lcas!inner(organization_id)
      `)
      .eq('id', materialId)
      .single();

    if (materialError || !material) {
      throw new Error("Ingredient not found");
    }

    const orgId = (material as any).product_lcas.organization_id;

    if (orgId !== organizationId) {
      throw new Error("Ingredient does not belong to specified organization");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const { error } = await supabase
      .from('product_lca_materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      throw new Error(`Failed to remove ingredient: ${error.message}`);
    }

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', lcaId);

    await saveDraftData(lcaId, 'ingredients', existingMaterials || []);

    console.log('[ingredientOperations] Removed ingredient:', { materialId });

    return { success: true };
  } catch (error) {
    console.error('[removeIngredient] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to remove ingredient";
    return { success: false, error: message };
  }
}

export async function getIngredientsForLCA(lcaId: string, organizationId: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const { data, error } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', lcaId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ingredients: ${error.message}`);
    }

    // Manually fetch related data for non-null foreign keys
    const enrichedIngredients = await Promise.all((data || []).map(async (material: any) => {
      let supplier_name = null;
      let sub_stage_name = null;

      // Fetch supplier name if supplier_product_id exists
      if (material.supplier_product_id) {
        const { data: supplierProduct } = await supabase
          .from('supplier_products')
          .select('name, suppliers(name)')
          .eq('id', material.supplier_product_id)
          .maybeSingle();

        if (supplierProduct) {
          supplier_name = (supplierProduct as any).suppliers?.name || null;
        }
      }

      // Fetch sub stage name if lca_sub_stage_id exists
      if (material.lca_sub_stage_id) {
        const { data: subStage } = await supabase
          .from('lca_sub_stages')
          .select('name')
          .eq('id', material.lca_sub_stage_id)
          .maybeSingle();

        if (subStage) {
          sub_stage_name = subStage.name;
        }
      }

      return {
        ...material,
        supplier_name,
        sub_stage_name,
      };
    }));

    return {
      success: true,
      ingredients: enrichedIngredients as IngredientMaterial[],
    };
  } catch (error) {
    console.error('[getIngredientsForLCA] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch ingredients";
    return {
      success: false,
      error: message,
      ingredients: [],
    };
  }
}

export async function markIngredientsComplete(lcaId: string, organizationId: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      throw new Error("User not authorized for this organization");
    }

    const { data: materials } = await supabase
      .from('product_lca_materials')
      .select('id')
      .eq('product_lca_id', lcaId);

    if (!materials || materials.length === 0) {
      throw new Error("Cannot mark complete - no ingredients added yet");
    }

    const result = await markTabComplete(lcaId, 'ingredients');

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[ingredientOperations] Marked ingredients tab complete');

    return { success: true };
  } catch (error) {
    console.error('[markIngredientsComplete] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to mark complete";
    return { success: false, error: message };
  }
}
