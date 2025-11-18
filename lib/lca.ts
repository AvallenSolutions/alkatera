import { supabase } from './supabaseClient';
import type { SimpleMaterialInput, ProductLcaMaterial, LcaStageWithSubStages } from './types/lca';

export async function createDraftLca(productId: string, organizationId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    if (!product) {
      throw new Error("Product not found");
    }

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .insert({
        organization_id: organizationId,
        product_name: product.name,
        functional_unit: "1 unit",
        system_boundary: "Cradle to gate",
        status: "draft",
      })
      .select()
      .single();

    if (lcaError) {
      throw new Error(`Failed to create LCA: ${lcaError.message}`);
    }

    return { success: true, lcaId: lca.id };
  } catch (error) {
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
  const { data: stages, error: stagesError } = await supabase
    .from('lca_life_cycle_stages')
    .select('*')
    .order('display_order');

  if (stagesError) {
    throw new Error(`Failed to fetch LCA stages: ${stagesError.message}`);
  }

  const { data: subStages, error: subStagesError } = await supabase
    .from('lca_sub_stages')
    .select('*')
    .order('display_order');

  if (subStagesError) {
    throw new Error(`Failed to fetch LCA sub-stages: ${subStagesError.message}`);
  }

  return (stages || []).map((stage) => ({
    ...stage,
    sub_stages: (subStages || []).filter((sub) => sub.stage_id === stage.id),
  }));
}

export async function fetchLcaMaterials(lcaId: string): Promise<ProductLcaMaterial[]> {
  const { data, error } = await supabase
    .from('product_lca_materials')
    .select('*')
    .eq('product_lca_id', lcaId)
    .order('created_at');

  if (error) {
    throw new Error(`Failed to fetch materials: ${error.message}`);
  }

  return data || [];
}

export async function saveOrUpdateMaterials(
  lcaId: string,
  materials: SimpleMaterialInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

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
      }));

      const { error: insertError } = await supabase
        .from('product_lca_materials')
        .insert(materialsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert materials: ${insertError.message}`);
      }
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save materials";
    return { success: false, error: message };
  }
}
