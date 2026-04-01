import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * POST /api/data/backfill-quality
 *
 * Backfills data_quality_grade, gwp_data_source, non_gwp_data_source,
 * and is_hybrid_source on product_carbon_footprint_materials rows
 * that have these columns NULL but have data_priority / data_quality_tag
 * / impact_source populated.
 *
 * Requires either:
 *  - CRON_SECRET header (for automated jobs)
 *  - Authenticated alkatera admin user
 */
export async function POST(req: NextRequest) {
  try {
    // Option 1: CRON_SECRET for automated jobs
    const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && cronSecret === expectedSecret) {
      // Authorised via cron secret — proceed with service client
      return await runBackfill();
    }

    // Option 2: Authenticated alkatera admin
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an alkatera admin
    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin', { p_user_id: user.id });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    return await runBackfill();
  } catch (err: any) {
    console.error('Backfill error:', err);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}

async function runBackfill() {
  const { client: supabase } = await getSupabaseAPIClient();

  // Fetch all materials missing data_quality_grade
  const { data: materials, error: fetchError } = await supabase
    .from('product_carbon_footprint_materials')
    .select('id, data_priority, data_quality_tag, impact_source, data_source, supplier_product_id, source_reference, gwp_data_source, non_gwp_data_source, is_hybrid_source')
    .is('data_quality_grade', null);

  if (fetchError) throw fetchError;

  if (!materials || materials.length === 0) {
    return NextResponse.json({ message: 'No materials need backfilling', updated: 0 });
  }

  let updated = 0;

  for (const m of materials) {
    // Derive data_quality_grade
    let grade: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (m.data_priority === 1) grade = 'HIGH';
    else if (m.data_priority === 2) grade = 'MEDIUM';
    else if (m.data_priority === 3) grade = 'LOW';
    else if (m.data_quality_tag === 'Primary_Verified') grade = 'HIGH';
    else if (m.data_quality_tag === 'Regional_Standard') grade = 'MEDIUM';
    else if (m.impact_source === 'supplier_verified') grade = 'HIGH';
    else if (m.impact_source === 'regional_standard' || m.impact_source === 'hybrid') grade = 'MEDIUM';
    else if (m.data_source === 'supplier') grade = 'HIGH';
    else if (m.data_source === 'openlca') grade = 'MEDIUM';

    // Derive gwp_data_source if missing
    let gwpSource = m.gwp_data_source || null;
    if (!gwpSource) {
      if (m.data_source === 'supplier') gwpSource = 'Supplier EPD';
      else if (m.impact_source === 'regional_standard') gwpSource = 'DEFRA 2025';
      else if (m.impact_source === 'hybrid') gwpSource = 'DEFRA 2025';
      else if (m.data_source === 'openlca') gwpSource = 'Ecoinvent 3.12';
      else if (m.impact_source === 'secondary_modelled') gwpSource = 'Ecoinvent 3.12';
      else if (m.impact_source === 'staging_factor') gwpSource = 'Alkatera staging factor';
      else gwpSource = 'Unknown';
    }

    // Derive non_gwp_data_source if missing
    let nonGwpSource = m.non_gwp_data_source || null;
    if (!nonGwpSource) {
      if (m.impact_source === 'hybrid') nonGwpSource = 'Ecoinvent 3.12';
      else nonGwpSource = gwpSource;
    }

    // Derive is_hybrid_source if missing
    let hybrid = m.is_hybrid_source;
    if (hybrid === null || hybrid === undefined) {
      hybrid = m.impact_source === 'hybrid' || (gwpSource !== nonGwpSource && nonGwpSource !== null);
    }

    const { error: updateError } = await supabase
      .from('product_carbon_footprint_materials')
      .update({
        data_quality_grade: grade,
        gwp_data_source: gwpSource,
        non_gwp_data_source: nonGwpSource,
        is_hybrid_source: hybrid,
      })
      .eq('id', m.id);

    if (updateError) {
      console.error(`Failed to update material ${m.id}:`, updateError);
      continue;
    }
    updated++;
  }

  return NextResponse.json({
    message: `Backfilled ${updated} of ${materials.length} materials`,
    updated,
    total: materials.length,
  });
}
