import { supabase } from './supabaseClient';
import { saveDraftData, markTabComplete } from './lcaWorkflow';
import type { DataSource, PackagingCategory, ImpactSourceType } from './types/lca';

export interface AddPackagingParams {
  lcaId: string;
  organizationId: string;
  packaging: {
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
    packaging_category: PackagingCategory;
    label_printing_type?: string;
    impact_climate?: number;
    impact_water?: number;
    impact_land?: number;
    impact_waste?: number;
    impact_source?: ImpactSourceType;
    impact_reference_id?: string;
  };
}

export interface UpdatePackagingParams {
  materialId: string;
  lcaId: string;
  organizationId: string;
  updates: {
    quantity?: number;
    unit?: string;
    lca_sub_stage_id?: number;
    origin_country?: string;
    is_organic_certified?: boolean;
    label_printing_type?: string;
  };
}

export interface PackagingMaterial {
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
  packaging_category: PackagingCategory;
  label_printing_type: string | null;
  created_at: string;
  updated_at: string;
}

export async function addPackagingToLCA(params: AddPackagingParams) {
  console.log('[addPackagingToLCA] Called with params:', params);
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[addPackagingToLCA] Auth error:', authError);
      throw new Error("User not authenticated");
    }

    console.log('[addPackagingToLCA] User authenticated:', user.id);

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
      name: params.packaging.name,
      quantity: params.packaging.quantity,
      unit: params.packaging.unit,
      lca_sub_stage_id: params.packaging.lca_sub_stage_id,
      data_source: params.packaging.data_source,
      data_source_id: params.packaging.data_source_id || null,
      supplier_product_id: params.packaging.supplier_product_id || null,
      origin_country: params.packaging.origin_country || null,
      is_organic_certified: params.packaging.is_organic_certified,
      packaging_category: params.packaging.packaging_category,
      label_printing_type: params.packaging.label_printing_type || null,
      impact_climate: params.packaging.impact_climate || null,
      impact_water: params.packaging.impact_water || null,
      impact_land: params.packaging.impact_land || null,
      impact_waste: params.packaging.impact_waste || null,
      impact_source: params.packaging.impact_source || 'secondary_modelled',
      impact_reference_id: params.packaging.impact_reference_id || params.packaging.data_source_id || null,
    };

    console.log('[addPackagingToLCA] Inserting material:', materialData);

    const { data, error } = await supabase
      .from('product_lca_materials')
      .insert(materialData)
      .select()
      .single();

    if (error) {
      console.error('[addPackagingToLCA] Insert error:', error);
      throw new Error(`Failed to add packaging: ${error.message}`);
    }

    console.log('[addPackagingToLCA] Insert successful:', data);

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', params.lcaId)
      .not('packaging_category', 'is', null);

    const enrichedMaterial = {
      ...data,
      supplier_name: params.packaging.supplier_name,
    };

    await saveDraftData(params.lcaId, 'packaging', existingMaterials || []);

    console.log('[packagingOperations] Added packaging:', {
      packagingId: data.id,
      name: params.packaging.name,
      category: params.packaging.packaging_category,
      source: params.packaging.data_source,
    });

    return { success: true, packagingId: data.id, packaging: enrichedMaterial };
  } catch (error) {
    console.error('[addPackagingToLCA] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to add packaging";
    return { success: false, error: message };
  }
}

export async function updatePackaging(params: UpdatePackagingParams) {
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
      throw new Error("Packaging not found");
    }

    const orgId = (material as any).product_lcas.organization_id;

    if (orgId !== params.organizationId) {
      throw new Error("Packaging does not belong to specified organization");
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
      throw new Error(`Failed to update packaging: ${error.message}`);
    }

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', params.lcaId)
      .not('packaging_category', 'is', null);

    await saveDraftData(params.lcaId, 'packaging', existingMaterials || []);

    console.log('[packagingOperations] Updated packaging:', {
      packagingId: params.materialId,
      updates: Object.keys(params.updates),
    });

    return { success: true, packaging: data };
  } catch (error) {
    console.error('[updatePackaging] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to update packaging";
    return { success: false, error: message };
  }
}

export async function removePackaging(materialId: string, lcaId: string, organizationId: string) {
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
      throw new Error("Packaging not found");
    }

    const orgId = (material as any).product_lcas.organization_id;

    if (orgId !== organizationId) {
      throw new Error("Packaging does not belong to specified organization");
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
      throw new Error(`Failed to remove packaging: ${error.message}`);
    }

    const { data: existingMaterials } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', lcaId)
      .not('packaging_category', 'is', null);

    await saveDraftData(lcaId, 'packaging', existingMaterials || []);

    console.log('[packagingOperations] Removed packaging:', { materialId });

    return { success: true };
  } catch (error) {
    console.error('[removePackaging] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to remove packaging";
    return { success: false, error: message };
  }
}

export async function getPackagingForLCA(lcaId: string, organizationId: string) {
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
      .eq('material_type', 'packaging')
      .order('packaging_category', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch packaging: ${error.message}`);
    }

    const enrichedPackaging = await Promise.all((data || []).map(async (material: any) => {
      let supplier_name = null;
      let sub_stage_name = null;

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
      packaging: enrichedPackaging as PackagingMaterial[],
    };
  } catch (error) {
    console.error('[getPackagingForLCA] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch packaging";
    return {
      success: false,
      error: message,
      packaging: [],
    };
  }
}

export async function markPackagingComplete(lcaId: string, organizationId: string) {
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
      .eq('product_lca_id', lcaId)
      .not('packaging_category', 'is', null);

    if (!materials || materials.length === 0) {
      throw new Error("Cannot mark complete - no packaging added yet");
    }

    const result = await markTabComplete(lcaId, 'packaging');

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('[packagingOperations] Marked packaging tab complete');

    return { success: true };
  } catch (error) {
    console.error('[markPackagingComplete] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to mark complete";
    return { success: false, error: message };
  }
}
