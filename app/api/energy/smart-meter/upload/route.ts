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

  // De-dupe within the file (last wins) before upsert.
  const byTime = new Map<string, number>();
  for (const r of parsed.readings) byTime.set(r.recordedAt, r.kwh);
  const rows = Array.from(byTime.entries()).map(([recordedAt, kwh]) => ({
    facility_id: facilityId,
    fuel,
    recorded_at: recordedAt,
    consumption_kwh: kwh,
    meter_id: meterId,
    source: 'csv_upload',
  }));

  const admin = serviceClient();
  // Upsert in chunks to stay well within statement limits.
  const CHUNK = 2000;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from('smart_meter_readings')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'facility_id,fuel,recorded_at' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    written += Math.min(CHUNK, rows.length - i);
  }

  return NextResponse.json({
    ok: true,
    format: parsed.format,
    readingsWritten: written,
    rowsParsed: parsed.rowsParsed,
    warnings: parsed.errors,
  });
}
