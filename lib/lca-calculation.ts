import { supabase } from './supabaseClient';
import type { ProductLcaMaterial } from './types/lca';

export async function runLcaCalculation(lcaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: lca, error: lcaError } = await supabase
      .from('product_lcas')
      .select('organization_id, product_name')
      .eq('id', lcaId)
      .maybeSingle();

    if (lcaError) {
      throw new Error(`Failed to fetch LCA: ${lcaError.message}`);
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
      throw new Error("Not authorized to perform this action");
    }

    const { data: materials, error: materialsError } = await supabase
      .from('product_lca_materials')
      .select('*')
      .eq('product_lca_id', lcaId);

    if (materialsError) {
      throw new Error(`Failed to fetch materials: ${materialsError.message}`);
    }

    if (!materials || materials.length === 0) {
      throw new Error("No materials found. Please add materials before calculating.");
    }

    console.log('[runLcaCalculation] Calling edge function with:', {
      lcaId,
      materialsCount: materials.length,
      firstMaterial: materials[0],
    });

    // Call the calculation engine (for detailed calculation logs)
    const { data, error: functionError } = await supabase.functions.invoke('invoke-calculation-engine', {
      body: {
        lcaId,
        materials,
      },
    });

    console.log('[runLcaCalculation] Edge function response:', { data, functionError });

    if (functionError) {
      console.warn('[runLcaCalculation] Edge function warning:', functionError);
      // Don't throw error, continue to aggregation
    }

    if (data && !data.success) {
      console.warn('[runLcaCalculation] Edge function returned warning:', data);
      // Don't throw error, continue to aggregation
    }

    // Call the new aggregation function to calculate accurate impacts
    console.log('[runLcaCalculation] Calling calculate-product-lca-impacts...');
    const { data: impactsData, error: impactsError } = await supabase.functions.invoke('calculate-product-lca-impacts', {
      body: {
        product_lca_id: lcaId,
      },
    });

    console.log('[runLcaCalculation] Impacts calculation response:', { impactsData, impactsError });

    if (impactsError) {
      console.error('[runLcaCalculation] Impacts calculation error:', impactsError);
      throw new Error(`Failed to calculate impacts: ${impactsError.message}`);
    }

    if (!impactsData || !impactsData.success) {
      console.error('[runLcaCalculation] Impacts calculation returned failure:', impactsData);
      throw new Error(impactsData?.error || "Failed to calculate impacts");
    }

    console.log('[runLcaCalculation] Successfully calculated impacts:', impactsData.aggregated_impacts);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run calculation";
    return { success: false, error: message };
  }
}
