import { supabase } from './supabaseClient';

export interface InitiateLcaParams {
  productId: string;
  organizationId: string;
  functionalUnit: string;
  systemBoundary: 'cradle-to-gate' | 'cradle-to-grave';
}

export interface WorkflowAuditParams {
  lcaId: string;
  workflowStep: string;
  action: string;
  metadata?: Record<string, any>;
}

export async function initiateLcaWorkflow(params: InitiateLcaParams) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, product_description, product_image_url")
      .eq("id", params.productId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    if (!product) {
      throw new Error("Product not found");
    }

    const lcaData = {
      organization_id: params.organizationId,
      product_id: parseInt(params.productId),
      product_name: product.name,
      product_description: product.product_description || null,
      product_image_url: product.product_image_url || null,
      functional_unit: params.functionalUnit,
      system_boundary: params.systemBoundary,
      lca_version: "1.0",
      lca_scope_type: params.systemBoundary,
      goal_and_scope_confirmed: true,
      goal_and_scope_confirmed_at: new Date().toISOString(),
      goal_and_scope_confirmed_by: user.id,
      is_draft: true,
      status: 'draft',
      draft_data: {
        ingredients: [],
        packaging: [],
        production: null,
      },
    };

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .insert(lcaData)
      .select()
      .single();

    if (lcaError) {
      throw new Error(`Failed to create LCA: ${lcaError.message}`);
    }

    // Copy product materials (ingredients and packaging) to the LCA
    try {
      const { data: materials, error: materialsError } = await supabase
        .from('product_materials')
        .select('*')
        .eq('product_id', params.productId);

      if (materialsError) {
        console.warn('[initiateLcaWorkflow] Could not fetch product materials:', materialsError);
      } else if (materials && materials.length > 0) {
        // Prepare LCA materials
        const lcaMaterials = materials.map(material => ({
          product_lca_id: lca.id,
          organization_id: params.organizationId,
          material_name: material.material_name,
          material_type: material.material_type,
          quantity: material.quantity,
          unit: material.unit,
          data_source: material.data_source,
          data_source_id: material.data_source_id,
          supplier_product_id: material.supplier_product_id,
          origin_country: material.origin_country,
          is_organic_certified: material.is_organic_certified,
          packaging_category: material.packaging_category,
          lca_stage_id: 1, // Default to first stage (materials/ingredients)
          lca_sub_stage_id: null,
        }));

        const { error: insertError } = await supabase
          .from('product_lca_materials')
          .insert(lcaMaterials);

        if (insertError) {
          console.warn('[initiateLcaWorkflow] Could not copy materials to LCA:', insertError);
        } else {
          console.log(`[initiateLcaWorkflow] Copied ${materials.length} materials to LCA`);
        }
      }
    } catch (copyError) {
      console.warn('[initiateLcaWorkflow] Error copying materials:', copyError);
      // Don't fail the LCA creation if copying fails
    }

    await logWorkflowAction({
      lcaId: lca.id,
      workflowStep: 'goal_and_scope',
      action: 'confirmed',
      metadata: {
        functional_unit: params.functionalUnit,
        system_boundary: params.systemBoundary,
      },
    });

    return { success: true, lcaId: lca.id };
  } catch (error) {
    console.error('[initiateLcaWorkflow] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to initiate LCA workflow";
    return { success: false, error: message };
  }
}

export async function saveDraftData(
  lcaId: string,
  tabName: 'ingredients' | 'packaging' | 'production',
  data: any
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: currentLca, error: fetchError } = await supabase
      .from("product_lcas")
      .select("draft_data")
      .eq("id", lcaId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch LCA: ${fetchError.message}`);
    }

    const updatedDraftData = {
      ...currentLca.draft_data,
      [tabName]: data,
    };

    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        draft_data: updatedDraftData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lcaId);

    if (updateError) {
      throw new Error(`Failed to save draft data: ${updateError.message}`);
    }

    await logWorkflowAction({
      lcaId,
      workflowStep: tabName,
      action: 'draft_saved',
      metadata: { item_count: Array.isArray(data) ? data.length : 1 },
    });

    return { success: true };
  } catch (error) {
    console.error('[saveDraftData] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to save draft data";
    return { success: false, error: message };
  }
}

export async function markTabComplete(
  lcaId: string,
  tabName: 'ingredients' | 'packaging' | 'production'
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const fieldName = `${tabName}_complete`;

    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        [fieldName]: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lcaId);

    if (updateError) {
      throw new Error(`Failed to mark tab complete: ${updateError.message}`);
    }

    await logWorkflowAction({
      lcaId,
      workflowStep: tabName,
      action: 'completed',
    });

    return { success: true };
  } catch (error) {
    console.error('[markTabComplete] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to mark tab complete";
    return { success: false, error: message };
  }
}

export async function getAllTabsComplete(lcaId: string) {
  try {
    const { data, error } = await supabase
      .from("product_lcas")
      .select("ingredients_complete, packaging_complete, production_complete, lca_scope_type")
      .eq("id", lcaId)
      .single();

    if (error) {
      throw new Error(`Failed to check tab completion: ${error.message}`);
    }

    if (data.lca_scope_type === 'cradle-to-gate') {
      return {
        allComplete: data.ingredients_complete && data.packaging_complete && data.production_complete,
        details: {
          ingredients: data.ingredients_complete,
          packaging: data.packaging_complete,
          production: data.production_complete,
        },
      };
    }

    return {
      allComplete: false,
      details: {
        ingredients: data.ingredients_complete,
        packaging: data.packaging_complete,
        production: data.production_complete,
      },
    };
  } catch (error) {
    console.error('[getAllTabsComplete] Error:', error);
    return {
      allComplete: false,
      details: {
        ingredients: false,
        packaging: false,
        production: false,
      },
    };
  }
}

export async function extendToGrave(parentLcaId: string) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { data: parentLca, error: parentError } = await supabase
      .from("product_lcas")
      .select("*")
      .eq("id", parentLcaId)
      .single();

    if (parentError) {
      throw new Error(`Failed to fetch parent LCA: ${parentError.message}`);
    }

    const parentVersion = parseFloat(parentLca.lca_version || "1.0");
    const newVersion = (parentVersion + 1.0).toFixed(1);

    const extendedLcaData = {
      organization_id: parentLca.organization_id,
      product_id: parentLca.product_id,
      product_name: parentLca.product_name,
      product_description: parentLca.product_description,
      product_image_url: parentLca.product_image_url,
      functional_unit: parentLca.functional_unit,
      system_boundary: 'cradle-to-grave',
      lca_version: newVersion,
      lca_scope_type: 'cradle-to-grave',
      parent_lca_id: parentLcaId,
      goal_and_scope_confirmed: true,
      goal_and_scope_confirmed_at: new Date().toISOString(),
      goal_and_scope_confirmed_by: user.id,
      is_draft: true,
      status: 'draft',
      draft_data: {
        ...parentLca.draft_data,
        distribution: [],
        use_and_eol: null,
      },
      ingredients_complete: parentLca.ingredients_complete,
      packaging_complete: parentLca.packaging_complete,
      production_complete: parentLca.production_complete,
    };

    const { data: extendedLca, error: extendError } = await supabase
      .from("product_lcas")
      .insert(extendedLcaData)
      .select()
      .single();

    if (extendError) {
      throw new Error(`Failed to create extended LCA: ${extendError.message}`);
    }

    await logWorkflowAction({
      lcaId: extendedLca.id,
      workflowStep: 'lca_extension',
      action: 'created',
      metadata: {
        parent_lca_id: parentLcaId,
        extended_from_version: parentLca.lca_version,
        new_version: newVersion,
      },
    });

    return { success: true, lcaId: extendedLca.id };
  } catch (error) {
    console.error('[extendToGrave] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to extend LCA";
    return { success: false, error: message };
  }
}

export async function getLcaVersionHistory(productId: string) {
  try {
    const { data, error } = await supabase
      .from("product_lcas")
      .select("id, lca_version, lca_scope_type, status, created_at, parent_lca_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch version history: ${error.message}`);
    }

    return { success: true, versions: data || [] };
  } catch (error) {
    console.error('[getLcaVersionHistory] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch version history";
    return { success: false, error: message, versions: [] };
  }
}

export async function getWorkflowAuditTrail(lcaId: string) {
  try {
    const { data, error } = await supabase
      .from("lca_workflow_audit")
      .select(`
        id,
        workflow_step,
        action,
        metadata,
        created_at,
        user_id
      `)
      .eq("product_lca_id", lcaId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch audit trail: ${error.message}`);
    }

    return { success: true, auditTrail: data || [] };
  } catch (error) {
    console.error('[getWorkflowAuditTrail] Error:', error);
    const message = error instanceof Error ? error.message : "Failed to fetch audit trail";
    return { success: false, error: message, auditTrail: [] };
  }
}

async function logWorkflowAction(params: WorkflowAuditParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[logWorkflowAction] No authenticated user, skipping audit log');
      return;
    }

    const { error } = await supabase
      .from("lca_workflow_audit")
      .insert({
        product_lca_id: params.lcaId,
        workflow_step: params.workflowStep,
        action: params.action,
        user_id: user.id,
        metadata: params.metadata || {},
      });

    if (error) {
      console.error('[logWorkflowAction] Failed to log action:', error);
    }
  } catch (error) {
    console.error('[logWorkflowAction] Error:', error);
  }
}
