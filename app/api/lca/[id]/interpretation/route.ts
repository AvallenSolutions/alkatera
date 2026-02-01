import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { generateLcaInterpretation } from '@/lib/lca-interpretation-engine';

/**
 * GET /api/lca/[id]/interpretation
 * Fetch existing interpretation results for a PCF
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
    .select('*')
    .eq('product_carbon_footprint_id', pcfId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'No interpretation found for this LCA' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/lca/[id]/interpretation
 * Generate (or regenerate) interpretation for a PCF
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

  // Get the organization_id from the PCF
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

  return NextResponse.json(result.data);
}

/**
 * PUT /api/lca/[id]/interpretation
 * Update interpretation (e.g. manually edited conclusions)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;
  const { client, user, error: authError } = await getSupabaseAPIClient();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await client
    .from('lca_interpretation_results')
    .update({
      key_findings: body.key_findings,
      limitations: body.limitations,
      recommendations: body.recommendations,
      uncertainty_statement: body.uncertainty_statement,
      updated_at: new Date().toISOString(),
    })
    .eq('product_carbon_footprint_id', pcfId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
