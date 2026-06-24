/**
 * Pulse -- Soil carbon trajectory.
 *
 * GET /api/pulse/soil-carbon-trajectory?organization_id=<uuid>
 *
 * Returns, per land unit, the measured SOC stock time series and the derived
 * annual stock-change, plus an org-level summary. "Measure the place, track the
 * trajectory": the headline is the measured direction and scale of change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  computeAnnualStockChange,
  buildSoilCarbonTrajectory,
} from '@/lib/soil-carbon';
import {
  LAND_UNIT_META,
  rowToSample,
  type LandUnitType,
} from '@/lib/soil-carbon-server';

export const runtime = 'nodejs';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveOrg(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthenticated', status: 401 as const };

  const orgIdParam = request.nextUrl.searchParams.get('organization_id');

  // Member OR active advisor for the requested/selected org.
  const organizationId = await resolveAccessibleOrg(serviceClient(), user, orgIdParam);
  if (!organizationId) return { error: 'No organisation', status: 403 as const };
  return { organizationId };
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveOrg(request);
    if ('error' in resolved) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
    }
    const { organizationId } = resolved;
    const svc = serviceClient();

    const { data: rows } = await svc
      .from('soil_carbon_samples')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    const sampleRows = rows ?? [];

    // Resolve land-unit names + areas across the three base tables (org-scoped).
    const nameByKey = new Map<string, { name: string; hectares: number | null }>();
    for (const type of Object.keys(LAND_UNIT_META) as LandUnitType[]) {
      const { data: units } = await svc
        .from(LAND_UNIT_META[type].baseTable)
        .select('id, name, hectares')
        .eq('organization_id', organizationId);
      for (const u of units ?? []) {
        nameByKey.set(`${type}:${u.id}`, {
          name: (u as any).name ?? 'Land unit',
          hectares: (u as any).hectares ?? null,
        });
      }
    }

    // Group samples by land unit.
    const grouped = new Map<string, typeof sampleRows>();
    for (const r of sampleRows) {
      const key = `${r.land_unit_type}:${r.land_unit_id}`;
      const arr = grouped.get(key) ?? [];
      arr.push(r);
      grouped.set(key, arr);
    }

    let totalAnnualRemovalKgCo2e = 0;
    let measuredUnits = 0;

    const landUnits = Array.from(grouped.entries()).map(([key, groupRows]) => {
      const [land_unit_type, land_unit_id] = key.split(':');
      const samples = groupRows.map(rowToSample);
      const change = computeAnnualStockChange(samples);
      const series = buildSoilCarbonTrajectory(samples);
      const meta = nameByKey.get(key);
      const hectares = meta?.hectares ?? null;

      if (change.methodology === 'measured_stock_change' && hectares) {
        totalAnnualRemovalKgCo2e += change.annual_kg_co2e_per_ha * hectares;
        measuredUnits += 1;
      }

      return {
        land_unit_type,
        land_unit_id,
        name: meta?.name ?? 'Land unit',
        hectares,
        series,
        change,
      };
    });

    // Sort: measured first, then by sample count.
    landUnits.sort((a, b) => {
      const am = a.change.methodology === 'measured_stock_change' ? 1 : 0;
      const bm = b.change.methodology === 'measured_stock_change' ? 1 : 0;
      if (am !== bm) return bm - am;
      return b.series.length - a.series.length;
    });

    return NextResponse.json({
      ok: true,
      landUnits,
      summary: {
        totalLandUnits: landUnits.length,
        measuredUnits,
        totalAnnualRemovalKgCo2e,
      },
    });
  } catch (err) {
    console.error('[SoilCarbonTrajectory GET] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
