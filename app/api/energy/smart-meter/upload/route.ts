/**
 * POST /api/energy/smart-meter/upload   (multipart/form-data)
 *
 * Ingest a half-hourly smart-meter CSV/XLSX export for a facility into
 * `smart_meter_readings`. Fields: file, facility_id, fuel? ('electricity'|'gas',
 * default electricity), meter_id?.
 *
 * Access to the facility is verified with the user client (RLS); the readings
 * are written with the service client (smart_meter_readings is service-write).
 * Idempotent on (facility_id, fuel, recorded_at), so re-uploading is safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { parseHalfHourlyCsv } from '@/lib/energy/hh-csv-parser';
import { deriveMonthlyEntries, readingsSpan, fuelToUtility, type Fuel } from '@/lib/energy/derive-utility';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const facilityId = String(form?.get('facility_id') ?? '');
  const fuel = String(form?.get('fuel') ?? 'electricity');
  const meterId = form?.get('meter_id') ? String(form.get('meter_id')) : null;

  if (!(file instanceof File) || !facilityId) {
    return NextResponse.json({ error: 'file and facility_id are required' }, { status: 400 });
  }
  if (fuel !== 'electricity' && fuel !== 'gas') {
    return NextResponse.json({ error: "fuel must be 'electricity' or 'gas'" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
  }

  // Verify the user can access this facility (RLS on the user client).
  const { data: facility } = await supabase
    .from('facilities')
    .select('id')
    .eq('id', facilityId)
    .maybeSingle();
  if (!facility) {
    return NextResponse.json({ error: 'Facility not found or not accessible' }, { status: 403 });
  }

  const parsed = parseHalfHourlyCsv(await file.arrayBuffer());
  if (parsed.readings.length === 0) {
    return NextResponse.json(
      { error: 'No half-hourly readings found.', format: parsed.format, details: parsed.errors },
      { status: 422 },
    );
  }

  // De-dupe within the file (last wins).
  const byTime = new Map<string, number>();
  for (const r of parsed.readings) byTime.set(r.recordedAt, r.kwh);
  const dedup = Array.from(byTime.entries()).map(([recordedAt, kwh]) => ({ recordedAt, kwh }));

  const { utilityType } = fuelToUtility(fuel as Fuel);
  const span = readingsSpan(dedup);
  if (!span) return NextResponse.json({ error: 'No dated readings found.' }, { status: 422 });

  const admin = serviceClient();

  // Detect overlap with existing bill / manual utility entries for this meter.
  const { data: conflicts } = await admin
    .from('utility_data_entries')
    .select('id, reporting_period_start, reporting_period_end, quantity, unit')
    .eq('facility_id', facilityId)
    .eq('utility_type', utilityType)
    .lte('reporting_period_start', span.to)
    .gte('reporting_period_end', span.from)
    .or('data_source.is.null,data_source.neq.smart_meter');

  const resolution = request.nextUrl.searchParams.get('resolution'); // 'replace' | 'detail_only'

  // "Warn and let the user choose": surface the conflict, write nothing yet.
  if (conflicts && conflicts.length > 0 && resolution !== 'replace' && resolution !== 'detail_only') {
    return NextResponse.json(
      {
        conflict: true,
        fuel,
        span,
        summary: {
          readings: dedup.length,
          totalKwh: Math.round(dedup.reduce((s, r) => s + r.kwh, 0)),
          months: deriveMonthlyEntries(dedup, fuel as Fuel).length,
        },
        existing: conflicts.map((c) => ({
          from: c.reporting_period_start,
          to: c.reporting_period_end,
          quantity: Number(c.quantity),
          unit: c.unit,
        })),
      },
      { status: 409 },
    );
  }

  // 1. Write the half-hourly detail.
  const detail = dedup.map((r) => ({
    facility_id: facilityId,
    fuel,
    recorded_at: r.recordedAt,
    consumption_kwh: r.kwh,
    meter_id: meterId,
    source: 'csv_upload',
  }));
  const CHUNK = 2000;
  let written = 0;
  for (let i = 0; i < detail.length; i += CHUNK) {
    const { error } = await admin
      .from('smart_meter_readings')
      .upsert(detail.slice(i, i + CHUNK), { onConflict: 'facility_id,fuel,recorded_at' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    written += Math.min(CHUNK, detail.length - i);
  }

  // 2. Always replace our OWN prior derived rows for the overlapping span.
  await admin
    .from('utility_data_entries')
    .delete()
    .eq('facility_id', facilityId)
    .eq('utility_type', utilityType)
    .eq('data_source', 'smart_meter')
    .lte('reporting_period_start', span.to)
    .gte('reporting_period_end', span.from);

  // 3. On "replace", delete the conflicting bills too.
  let replacedBills = 0;
  if (resolution === 'replace' && conflicts && conflicts.length > 0) {
    await admin.from('utility_data_entries').delete().in('id', conflicts.map((c) => c.id));
    replacedBills = conflicts.length;
  }

  // 4. Derive the monthly totals (unless the user kept their bill: detail_only).
  let derivedEntries = 0;
  if (resolution !== 'detail_only') {
    const derived = deriveMonthlyEntries(dedup, fuel as Fuel).map((d) => ({
      ...d,
      facility_id: facilityId,
      mpan: fuel === 'electricity' ? meterId : null,
      mprn: fuel === 'gas' ? meterId : null,
    }));
    if (derived.length > 0) {
      const { error } = await admin.from('utility_data_entries').insert(derived);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      derivedEntries = derived.length;
    }
  }

  return NextResponse.json({
    ok: true,
    format: parsed.format,
    readingsWritten: written,
    derivedEntries,
    replacedBills,
    mode: resolution ?? 'fresh',
    warnings: parsed.errors,
  });
}
