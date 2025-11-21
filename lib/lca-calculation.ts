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

    const { data, error: functionError } = await supabase.functions.invoke('invoke-calculation-engine', {
      body: {
        lcaId,
        materials,
      },
    });

    console.log('[runLcaCalculation] Edge function response:', { data, functionError });

    if (functionError) {
      console.error('[runLcaCalculation] Edge function error:', functionError);
      throw new Error(`Calculation failed: ${functionError.message}`);
    }

    if (!data || !data.success) {
      console.error('[runLcaCalculation] Edge function returned failure:', data);
      throw new Error(data?.error || "Calculation failed");
    }

    const { error: updateError } = await supabase
      .from('product_lcas')
      .update({ status: 'completed' })
      .eq('id', lcaId);

    if (updateError) {
      console.error('Failed to update LCA status:', updateError);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run calculation";
    return { success: false, error: message };
  }
}
