import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import {
  fetchHistoricalSustainabilityMetrics,
  historicalTotalKgCo2e,
} from '@/lib/trends/historical-fallback';

/**
 * GET /api/emissions/corporate?year=YYYY[&organization_id=...]
 *
 * Server-side corporate footprint. The full calculateCorporateEmissions
 * cascade (~14 queries) used to run in the BROWSER via the supabase client —
 * each query a ~100ms HTTPS round trip, repeated per reporting year on the
 * scope-1-2 trends tab. Server↔DB round trips are 1-5ms, so running it here
 * cuts a multi-second dashboard load to one HTTP call.
 *
 * Returns the same shape useCompanyFootprint previously assembled client-side,
 * including the historical-imports fallback for empty years.
 */

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const orgIdParam = request.nextUrl.searchParams.get('organization_id');
    let organizationId = orgIdParam ?? null;
    if (!organizationId) {
      const { data: m } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      organizationId = m?.organization_id ?? null;
    } else {
      // A caller-supplied org id must never be trusted without verifying
      // membership: the calculation below runs with the service-role client.
      const { data: m } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }
    if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

    const yearParam = Number(request.nextUrl.searchParams.get('year'));
    const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : new Date().getFullYear();

    const svc = serviceClient();
    const result = await calculateCorporateEmissions(svc, organizationId, year);

    if (result.hasData) {
      return NextResponse.json({
        year,
        total_emissions: result.breakdown.total,
        breakdown: result.breakdown,
        status: 'Draft',
        last_updated: new Date().toISOString(),
        has_data: true,
        source: 'operational',
      });
    }

    // Imported sustainability-report fallback for empty years (never replaces
    // operational data — only fills years with no activity data).
    const historical = await fetchHistoricalSustainabilityMetrics(svc, organizationId, year);
    const importedTotal = historical ? historicalTotalKgCo2e(historical) : undefined;
    if (historical && importedTotal !== undefined) {
      const s1Kg = (historical.scope1_tco2e ?? 0) * 1000;
      const s2Kg = (historical.scope2_tco2e_market ?? historical.scope2_tco2e_location ?? 0) * 1000;
      const s3Kg = (historical.scope3_tco2e ?? 0) * 1000;
      return NextResponse.json({
        year,
        total_emissions: importedTotal,
        breakdown: {
          total: importedTotal,
          scope1: s1Kg,
          scope2: s2Kg,
          scope3: { total: s3Kg, byCategory: {} },
        },
        status: 'Draft',
        last_updated: null,
        has_data: true,
        source: 'imported',
      });
    }

    return NextResponse.json({
      year,
      total_emissions: 0,
      breakdown: null,
      status: 'Draft',
      last_updated: null,
      has_data: false,
    });
  } catch (error) {
    console.error('Error computing corporate footprint:', error);
    return NextResponse.json({ error: 'Failed to compute corporate footprint' }, { status: 500 });
  }
}
