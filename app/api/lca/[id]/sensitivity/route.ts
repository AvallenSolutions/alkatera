import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { generateLcaInterpretation } from '@/lib/lca-interpretation-engine';

/**
 * POST /api/lca/[id]/sensitivity/run
 * Run sensitivity analysis (triggers full interpretation regeneration)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: pcf, error: pcfError } = await client
    .from('product_carbon_footprints')
    .select('organization_id')
    .eq('id', pcfId)
    .single();

  if (pcfError || !pcf) {
    return NextResponse.json({ error: 'LCA not found' }, { status: 404 });
  }

  const result = await generateLcaInterpretation(client, {
    productCarbonFootprintId: pcfId,
    organizationId: pcf.organization_id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    sensitivity_results: result.data?.sensitivity_results || [],
    highly_sensitive_parameters: result.data?.highly_sensitive_parameters || [],
  });
}

/**
 * GET /api/lca/[id]/sensitivity/results
 * Get existing sensitivity analysis results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await client
    .from('lca_interpretation_results')
    .select('sensitivity_results, highly_sensitive_parameters')
    .eq('product_carbon_footprint_id', pcfId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'No analysis found. Run interpretation first.' }, { status: 404 });
  }

  return NextResponse.json(data);
}
