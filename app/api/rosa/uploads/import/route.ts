/**
 * Rosa — document import endpoint.
 *
 * POST /api/rosa/uploads/import
 * Body: {
 *   facility_id: string
 *   utility_type: string
 *   quantity: number
 *   unit: string
 *   reporting_period_start: string  // ISO date
 *   reporting_period_end: string    // ISO date
 *   notes?: string
 *   source_file_id?: string         // kept for audit trail
 * }
 *
 * The review modal is the confirmation step, so this route writes directly
 * to the appropriate data table without staging a pending action.
 *
 * Routing:
 *   - utility_type === 'water_intake' → facility_water_data table
 *   - everything else → utility_data_entries table
 *
 * Note: utility_data_entries links to facility (no organization_id column);
 * facility_water_data has both facility_id and organization_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Aligned with utility_type_enum in the database.
const VALID_UTILITY_TYPES = [
  'electricity_grid',
  'natural_gas',
  'natural_gas_m3',
  'lpg',
  'heat_steam_purchased',
  'diesel_stationary',
  'diesel_mobile',
  'petrol_mobile',
  'heavy_fuel_oil',
  'biomass_solid',
  'refrigerant_leakage',
] as const;

const WATER_TYPE = 'water_intake';

export async function POST(request: NextRequest) {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'No organisation membership' }, { status: 403 });
  }
  const organizationId = (membership as any).organization_id as string;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    facility_id,
    utility_type,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    notes,
    source_file_id,
  } = body as Record<string, unknown>;

  if (!facility_id || typeof facility_id !== 'string') {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 });
  }
  if (!utility_type || typeof utility_type !== 'string') {
    return NextResponse.json({ error: 'utility_type is required' }, { status: 400 });
  }
  if (utility_type !== WATER_TYPE && !(VALID_UTILITY_TYPES as readonly string[]).includes(utility_type)) {
    return NextResponse.json({ error: `utility_type must be 'water_intake' or one of: ${VALID_UTILITY_TYPES.join(', ')}` }, { status: 400 });
  }
  if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
    return NextResponse.json({ error: 'quantity is required and must be a number' }, { status: 400 });
  }
  if (!unit || typeof unit !== 'string') {
    return NextResponse.json({ error: 'unit is required' }, { status: 400 });
  }
  if (!reporting_period_start || typeof reporting_period_start !== 'string') {
    return NextResponse.json({ error: 'reporting_period_start is required (ISO date)' }, { status: 400 });
  }
  if (!reporting_period_end || typeof reporting_period_end !== 'string') {
    return NextResponse.json({ error: 'reporting_period_end is required (ISO date)' }, { status: 400 });
  }

  const { data: facility } = await userSupabase
    .from('facilities')
    .select('id')
    .eq('id', facility_id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!facility) {
    return NextResponse.json({ error: 'Facility not found or does not belong to this organisation' }, { status: 400 });
  }

  const notesParts: string[] = [];
  if (notes && typeof notes === 'string' && notes.trim()) notesParts.push(notes.trim());
  if (source_file_id && typeof source_file_id === 'string') notesParts.push('Imported from uploaded document.');
  const finalNotes = notesParts.length > 0 ? notesParts.join(' ') : null;

  // ───────────── Water route ─────────────
  if (utility_type === WATER_TYPE) {
    const periodStart = String(reporting_period_start);
    const totalM3 = Number(quantity);
    const reportingYear = parseInt(periodStart.slice(0, 4), 10);

    const row = {
      organization_id: organizationId,
      facility_id: String(facility_id),
      reporting_year: reportingYear,
      reporting_period_start: periodStart,
      reporting_period_end: String(reporting_period_end),
      total_consumption_m3: totalM3,
      municipal_consumption_m3: totalM3,
      data_quality: 'estimated',
      data_source: 'rosa_document_import',
      notes: finalNotes,
    };

    const { data, error } = await userSupabase
      .from('facility_water_data')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry_id: (data as any).id, table: 'facility_water_data', ok: true });
  }

  // ───────────── Utility route (electricity, gas, fuel, etc.) ─────────────
  const row = {
    facility_id: String(facility_id),
    utility_type: String(utility_type),
    quantity: Number(quantity),
    unit: String(unit),
    reporting_period_start: String(reporting_period_start),
    reporting_period_end: String(reporting_period_end),
    data_quality: 'actual',
    calculated_scope: '',
    notes: finalNotes,
    created_by: user.id,
  };

  const { data, error } = await userSupabase
    .from('utility_data_entries')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry_id: (data as any).id, table: 'utility_data_entries', ok: true });
}
