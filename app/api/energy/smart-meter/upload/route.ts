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
import { ingestHalfHourly } from '@/lib/energy/ingest-readings';
import type { Fuel } from '@/lib/energy/derive-utility';

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

  const resolution = request.nextUrl.searchParams.get('resolution') as 'replace' | 'detail_only' | null;

  let result;
  try {
    result = await ingestHalfHourly(serviceClient(), {
      facilityId,
      fuel: fuel as Fuel,
      bytes: await file.arrayBuffer(),
      meterId,
      resolution,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ingest failed' }, { status: 500 });
  }

  if (result.status === 'empty') {
    return NextResponse.json({ error: 'No half-hourly readings found.', format: result.format, details: result.errors }, { status: 422 });
  }
  if (result.status === 'conflict') {
    return NextResponse.json(
      { conflict: true, fuel: result.fuel, span: result.span, summary: result.summary, existing: result.existing },
      { status: 409 },
    );
  }
  return NextResponse.json({
    ok: true,
    format: result.format,
    readingsWritten: result.readingsWritten,
    derivedEntries: result.derivedEntries,
    replacedBills: result.replacedBills,
    mode: result.mode,
  });
}
