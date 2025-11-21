import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db_types';
import type { ProductLcaMaterial, LcaStageWithSubStages } from './types/lca';

/**
 * Server-only function to fetch LCA materials with authentication
 * Must be called from Server Components only
 */
export async function fetchLcaMaterials(lcaId: string): Promise<ProductLcaMaterial[]> {
  // Use authenticated server client that reads session from cookies
  const supabase = createServerComponentClient<Database>({ cookies });

  console.log('[fetchLcaMaterials] Fetching materials for LCA:', lcaId);

  // Verify authentication
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[fetchLcaMaterials] Session present:', !!session);

  const { data, error } = await supabase
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

/**
 * Server-only function to fetch LCA stages with sub-stages
 * Must be called from Server Components only
 */
export async function fetchLcaStagesWithSubStages(): Promise<LcaStageWithSubStages[]> {
  // Use authenticated server client that reads session from cookies
  const supabase = createServerComponentClient<Database>({ cookies });

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
    sub_stages: (subStages || []).filter((sub) => sub.lca_stage_id === stage.id),
  }));
}
