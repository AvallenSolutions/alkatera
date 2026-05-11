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
 * Mirrors the table routing used by lib/rosa/actions.ts execApproveException:
 *   - Water (water_intake)             → facility_activity_entries
 *   - Scope 1/2 utilities (electricity,
 *     gas, fuel, etc.)                 → utility_data_entries
 *
 * facility_activity_entries has organization_id; utility_data_entries does
 * not (it joins through facility).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

  // ───────────── Water route → facility_activity_entries ─────────────
  if (utility_type === WATER_TYPE) {
    const row = {
      organization_id: organizationId,
      facility_id: String(facility_id),
      activity_category: 'water_intake',
      activity_date: String(reporting_period_start),
      reporting_period_start: String(reporting_period_start),
      reporting_period_end: String(reporting_period_end),
      quantity: Number(quantity),
      unit: String(unit) || 'm3',
      data_provenance: 'primary_measured_onsite',
      allocation_basis: 'none',
      created_by: user.id,
    };

    const { data, error } = await userSupabase
      .from('facility_activity_entries')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[uploads/import] water insert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entryId = (data as any).id as string;
    await recordAuditTrail({
      organizationId,
      userId: user.id,
      facilityId: String(facility_id),
      sourceFileId: source_file_id as string | undefined,
      kind: 'water_bill',
      title: buildTitle('water_bill', body),
      appliedTo: { table: 'facility_activity_entries', entry_id: entryId },
      payload: body,
    });

    return NextResponse.json({
      entry_id: entryId,
      table: 'facility_activity_entries',
      ok: true,
    });
  }

  // ───────────── Utility route → utility_data_entries ─────────────
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
    console.error('[uploads/import] utility insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entryId = (data as any).id as string;
  await recordAuditTrail({
    organizationId,
    userId: user.id,
    facilityId: String(facility_id),
    sourceFileId: source_file_id as string | undefined,
    kind: 'utility_bill',
    title: buildTitle('utility_bill', body),
    appliedTo: { table: 'utility_data_entries', entry_id: entryId },
    payload: body,
  });

  return NextResponse.json({
    entry_id: entryId,
    table: 'utility_data_entries',
    ok: true,
  });
}

/**
 * Write an `agent_exceptions` row marked as already approved so the
 * import appears in "Recently from Rosa" with an audit trail. Uses the
 * service-role client because the table's RLS only lets the agent
 * itself write — end users insert via the queue's approve endpoint.
 *
 * We don't fail the request if this write errors out — the underlying
 * data entry has already been saved successfully.
 */
async function recordAuditTrail(args: {
  organizationId: string;
  userId: string;
  facilityId: string;
  sourceFileId?: string;
  kind: 'water_bill' | 'utility_bill';
  title: string;
  appliedTo: { table: string; entry_id: string };
  payload: Record<string, unknown>;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[uploads/import] audit trail skipped: service role not configured');
    return;
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();
  const row = {
    organization_id: args.organizationId,
    kind: args.kind,
    source: 'upload',
    source_ref: args.sourceFileId ? { file_id: args.sourceFileId } : {},
    payload: args.payload,
    suggested_facility_id: args.facilityId,
    title: args.title,
    status: 'approved',
    reviewed_by: args.userId,
    reviewed_at: nowIso,
    applied_to: args.appliedTo,
  };
  const { error } = await service.from('agent_exceptions').insert(row);
  if (error) {
    console.error('[uploads/import] audit trail write failed:', error);
  }
}

function buildTitle(kind: 'water_bill' | 'utility_bill', body: Record<string, unknown>): string {
  const qty = body.quantity != null ? String(body.quantity) : '';
  const unit = typeof body.unit === 'string' ? body.unit : '';
  const start = typeof body.reporting_period_start === 'string' ? body.reporting_period_start : '';
  const end = typeof body.reporting_period_end === 'string' ? body.reporting_period_end : '';
  const period = start && end ? ` (${start} to ${end})` : '';
  const label = kind === 'water_bill' ? 'Water bill' : 'Utility bill';
  const qtyText = qty ? `${qty} ${unit}` : '';
  return [label, qtyText, period].filter(Boolean).join(' · ').replace(' · (', ' (');
}
