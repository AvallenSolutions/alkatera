import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper';
import { getSpendFactor, calculateSpendBasedEmissions } from '@/lib/xero/spend-factors';

/**
 * POST /api/spend/freight
 *
 * Saves an extracted freight / logistics invoice as a Scope 3
 * (upstream_transportation) corporate-overheads row. Prefers activity-based
 * tonne-km (weight x distance x DEFRA freight factor) and falls back to a
 * spend-based estimate when weight/distance are missing.
 *
 * Runs as the authenticated user so org-scoped RLS is the access backstop.
 */

type TransportMode = 'truck' | 'train' | 'ship' | 'air';

// DEFRA freight factor names in staging_emission_factors (mirrors
// lib/utils/transport-emissions-calculator.ts, inlined for the server route).
const TRANSPORT_MODE_FACTOR_NAME: Record<TransportMode, string> = {
  truck: 'Freight - Road (HGV, Average laden)',
  train: 'Freight - Rail (Freight train, UK average)',
  ship: 'Freight - Sea (Container ship, Average)',
  air: 'Freight - Air (Dedicated freight service, Average)',
};

const ALLOWED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const body = await request.json();
    const carrierName: string = (body.carrier_name || '').toString().trim();
    const shipmentDate: string | undefined = body.shipment_date || undefined;
    const mode: TransportMode | undefined = TRANSPORT_MODE_FACTOR_NAME[body.transport_mode as TransportMode]
      ? (body.transport_mode as TransportMode)
      : undefined;
    const weightKg = Number(body.weight_kg);
    const distanceKm = Number(body.distance_km);
    const amount = Number(body.amount);
    const currency: string = ALLOWED_CURRENCIES.includes((body.currency || '').toUpperCase())
      ? body.currency.toUpperCase()
      : 'GBP';

    const hasActivity = mode && Number.isFinite(weightKg) && weightKg > 0 && Number.isFinite(distanceKm) && distanceKm > 0;
    const hasSpend = Number.isFinite(amount) && amount > 0;
    if (!hasActivity && !hasSpend) {
      return NextResponse.json(
        { error: 'Need either weight + distance + mode, or an invoice amount.' },
        { status: 400 },
      );
    }

    const year = deriveReportingYear(shipmentDate);
    const reportId = await getOrCreateCorporateReport(supabase, organizationId, year);

    const descBase = carrierName ? `${carrierName}: freight` : 'Freight';

    let row: Record<string, unknown>;
    let method: 'activity' | 'spend';

    if (hasActivity) {
      // Activity-based: tonne-km x DEFRA factor.
      const { data: factorRow } = await supabase
        .from('staging_emission_factors')
        .select('co2_factor')
        .eq('name', TRANSPORT_MODE_FACTOR_NAME[mode!])
        .eq('category', 'Transport')
        .maybeSingle();
      // Fallbacks (kg CO2e per tonne-km) if the factor table is unavailable.
      const DEFAULT_FACTOR: Record<TransportMode, number> = { truck: 0.104, train: 0.028, ship: 0.016, air: 1.13 };
      const factor = factorRow?.co2_factor != null ? Number(factorRow.co2_factor) : DEFAULT_FACTOR[mode!];
      const computed = (weightKg / 1000) * distanceKm * factor;
      method = 'activity';
      row = {
        report_id: reportId,
        category: 'upstream_transportation',
        description: `${descBase} (${mode}, ${weightKg} kg x ${distanceKm} km)`,
        spend_amount: hasSpend ? amount : 0,
        currency,
        ...(shipmentDate ? { entry_date: shipmentDate } : {}),
        transport_mode: mode,
        weight_kg: weightKg,
        distance_km: distanceKm,
        emission_factor: factor,
        computed_co2e: computed,
        data_source: 'invoice_upload',
      };
    } else {
      // Spend fallback: road-freight spend factor.
      const factor = getSpendFactor('road_freight');
      method = 'spend';
      row = {
        report_id: reportId,
        category: 'upstream_transportation',
        description: descBase,
        spend_amount: amount,
        currency,
        ...(shipmentDate ? { entry_date: shipmentDate } : {}),
        emission_factor: factor,
        computed_co2e: calculateSpendBasedEmissions(amount, 'road_freight', currency),
        data_source: 'invoice_upload',
      };
    }

    const { error } = await supabase.from('corporate_overheads').insert(row).select('id');
    if (error) {
      console.error('[spend/freight POST] Insert error:', error);
      return NextResponse.json({ error: 'Could not save the freight invoice.' }, { status: 500 });
    }

    return NextResponse.json(
      { saved: 1, method, year, total_co2e_kg: row.computed_co2e },
      { status: 201 },
    );
  } catch (err) {
    console.error('[spend/freight POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
