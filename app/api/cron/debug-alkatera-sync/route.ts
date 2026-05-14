import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

/**
 * Diagnostic endpoint — only meant to be hit from curl with CRON_SECRET
 * to debug why a specific brand isn't getting expected alka**tera**
 * findings. Dumps the link state, raw alkatera_org row, certification
 * rows (with framework join), the sync result, and any alkatera_live
 * findings on file. Returns everything in one JSON blob.
 *
 * Usage: GET /api/cron/debug-alkatera-sync?brand_profile_id=...
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  let brandProfileId = url.searchParams.get('brand_profile_id');
  const brandName = url.searchParams.get('brand_name');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  // Resolve brand_profile_id from brand_name if provided
  if (!brandProfileId && brandName) {
    const { data } = await supabase
      .from('brand_profiles')
      .select('id, name')
      .ilike('name', `%${brandName}%`)
      .limit(5);
    if (data && data.length === 1) {
      brandProfileId = (data[0] as { id: string }).id;
    } else if (data && data.length > 1) {
      return NextResponse.json(
        { error: 'multiple_brands_matched', matches: data },
        { status: 400 },
      );
    } else {
      return NextResponse.json({ error: 'brand_name_not_found' }, { status: 404 });
    }
  }

  if (!brandProfileId) {
    // Convenience: when called with no args, list all brand profiles
    // so the caller can pick the right id.
    const { data: brands } = await supabase
      .from('brand_profiles')
      .select('id, name, alkatera_org_id')
      .order('name')
      .limit(50);
    return NextResponse.json({
      hint: 'pass ?brand_profile_id=<uuid> or ?brand_name=<partial>',
      brands,
    });
  }

  const result: Record<string, unknown> = { brand_profile_id: brandProfileId };

  // 1. Brand profile (listing) + canonical directory entry
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, name, alkatera_org_id, alkatera_tier')
    .eq('id', brandProfileId)
    .maybeSingle();
  result.brand_profile = brand;
  const brandDirectoryId = (brand as { brand_directory_id?: string } | null)?.brand_directory_id;
  result.brand_directory_id = brandDirectoryId ?? null;

  // 2. Link state
  const { data: link } = await supabase
    .from('brand_distributor_links')
    .select('*')
    .eq('brand_profile_id', brandProfileId)
    .maybeSingle();
  result.link = link;

  const alkateraOrgId = (link as { alkatera_org_id?: string } | null)?.alkatera_org_id;
  result.alkatera_org_id = alkateraOrgId ?? null;

  if (alkateraOrgId) {
    // 3. Raw certification rows — both with and without the framework join
    const { data: certsRaw, error: certsRawError } = await supabase
      .from('organization_certifications')
      .select('*')
      .eq('organization_id', alkateraOrgId);
    result.certifications_raw = certsRaw;
    result.certifications_raw_error = certsRawError?.message ?? null;

    const { data: certsJoined, error: certsJoinedError } = await supabase
      .from('organization_certifications')
      .select(
        'status, certification_frameworks!inner(framework_code, framework_name, code, name)',
      )
      .eq('organization_id', alkateraOrgId);
    result.certifications_with_framework = certsJoined;
    result.certifications_with_framework_error = certsJoinedError?.message ?? null;

    // 4. Full alkatera org row — could hold cert flags as columns or jsonb
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', alkateraOrgId)
      .maybeSingle();
    result.alkatera_org_full = orgRow;

    // 5. Probe other plausible cert-bearing tables
    const probeTables = [
      'certifications',
      'org_certifications',
      'organization_attributes',
      'organization_profile',
      'sustainability_profile',
      'bcorp_certifications',
      'brand_certifications',
    ];
    const probes: Record<string, { count: number | null; error: string | null }> = {};
    for (const t of probeTables) {
      try {
        const { count, error } = await supabase
          .from(t)
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', alkateraOrgId);
        probes[t] = { count: count ?? null, error: error?.message ?? null };
      } catch (e) {
        probes[t] = { count: null, error: e instanceof Error ? e.message : String(e) };
      }
    }
    result.probe_other_cert_tables = probes;

    // 6. Sample row counts on the tables sync DOES read, so we can
    // see what data Avallen actually has on the alka**tera** side.
    const dataTables = [
      'ghg_emissions',
      'product_carbon_footprints',
      'facility_water_data',
      'transition_plans',
      'flag_targets',
      'packaging_circularity_profiles',
    ];
    const dataCounts: Record<string, { count: number | null }> = {};
    for (const t of dataTables) {
      try {
        const { count } = await supabase
          .from(t)
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', alkateraOrgId);
        dataCounts[t] = { count: count ?? null };
      } catch {
        dataCounts[t] = { count: null };
      }
    }
    result.alkatera_data_counts = dataCounts;

    // 7. Run the sync and capture its full result. Sync is keyed by
    //    directory id (Phase 3) so resolve from the listing first.
    if (brandDirectoryId) {
      const syncResult = await syncAlkateraDataForBrand(supabase, brandDirectoryId);
      result.sync_result = syncResult;
    } else {
      result.sync_result = { error: 'no_brand_directory_id_on_listing' };
    }
  }

  // 5. What's currently on file as alkatera_live for this directory entry.
  if (brandDirectoryId) {
    const { data: liveRows } = await supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, confidence, scraped_at')
      .eq('brand_directory_id', brandDirectoryId)
      .eq('source_name', 'alkatera_live')
      .is('superseded_by', null);
    result.alkatera_live_on_file = liveRows;
  } else {
    result.alkatera_live_on_file = null;
  }

  return NextResponse.json(result);
}
