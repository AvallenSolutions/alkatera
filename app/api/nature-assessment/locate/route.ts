import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/nature-assessment/locate
 *
 * Returns a summary of all vineyard and orchard sites with their TNFD
 * location sensitivity data (ecosystem type, biodiversity-sensitive area,
 * water stress). Used by the Nature Impact Assessment Locate section.
 *
 * Runs server-side to avoid PostgREST schema cache issues with newly
 * added columns when querying directly from the browser client.
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Get org from user metadata
    const orgId = user.user_metadata?.current_organization_id;
    if (!orgId) {
      return NextResponse.json({ error: 'No organisation selected' }, { status: 400 });
    }

    interface SiteEntry {
      name: string;
      type: 'vineyard' | 'orchard';
      ecosystem_type: string | null;
      in_biodiversity_sensitive_area: boolean;
      sensitive_area_details: string | null;
      water_stress_index: string | null;
    }

    const sites: SiteEntry[] = [];

    // Fetch vineyards
    const { data: vineyards, error: vErr } = await supabase
      .from('vineyards')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (vErr) {
      console.error('[NatureLocate] Vineyards query error:', vErr);
      return NextResponse.json({ error: 'Failed to fetch vineyards' }, { status: 500 });
    }

    if (vineyards) {
      for (const v of vineyards) {
        // Get the latest growing profile (all columns via *)
        const { data: profile } = await supabase
          .from('vineyard_growing_profiles')
          .select('*')
          .eq('vineyard_id', v.id)
          .order('vintage_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        sites.push({
          name: v.name,
          type: 'vineyard',
          ecosystem_type: profile?.ecosystem_type ?? null,
          in_biodiversity_sensitive_area: profile?.in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: profile?.sensitive_area_details ?? null,
          water_stress_index: profile?.water_stress_index ?? null,
        });
      }
    }

    // Fetch orchards
    const { data: orchards, error: oErr } = await supabase
      .from('orchards')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (oErr) {
      console.error('[NatureLocate] Orchards query error:', oErr);
      return NextResponse.json({ error: 'Failed to fetch orchards' }, { status: 500 });
    }

    if (orchards) {
      for (const o of orchards) {
        const { data: profile } = await supabase
          .from('orchard_growing_profiles')
          .select('*')
          .eq('orchard_id', o.id)
          .order('harvest_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        sites.push({
          name: o.name,
          type: 'orchard',
          ecosystem_type: profile?.ecosystem_type ?? null,
          in_biodiversity_sensitive_area: profile?.in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: profile?.sensitive_area_details ?? null,
          water_stress_index: profile?.water_stress_index ?? null,
        });
      }
    }

    // Build summary
    const totalSites = sites.length;
    const withEcosystem = sites.filter(s => s.ecosystem_type).length;
    const sensitiveSites = sites
      .filter(s => s.in_biodiversity_sensitive_area)
      .map(s => s.name || 'Unnamed site');
    const waterStress: Record<string, number> = {};
    for (const s of sites) {
      const level = s.water_stress_index || 'Not set';
      waterStress[level] = (waterStress[level] || 0) + 1;
    }

    return NextResponse.json({
      sites,
      summary: {
        totalSites,
        withEcosystem,
        sensitiveSites,
        waterStress,
      },
    });
  } catch (err: any) {
    console.error('[NatureLocate] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
