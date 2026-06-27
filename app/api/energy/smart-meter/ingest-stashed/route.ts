/**
 * POST /api/energy/smart-meter/ingest-stashed
 *
 * Save path for a half-hourly meter CSV that came through the smart-upload
 * pipeline. The file is already stashed in `ingest-staging`; the review step
 * confirms the facility + fuel, then calls this with the stashId. Runs the same
 * ingest core (parse → conflict warn → derive monthly totals) as the facility
 * tab upload.
 *
 * Body: { stashId, facilityId, fuel: 'electricity'|'gas', resolution? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { ingestHalfHourly } from '@/lib/energy/ingest-readings';
import type { Fuel } from '@/lib/energy/derive-utility';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const stashId = body?.stashId as string;
  const facilityId = body?.facilityId as string;
  const fuel = body?.fuel as string;
  const resolution = (body?.resolution as 'replace' | 'detail_only' | null) ?? null;

  if (!stashId || !facilityId) return NextResponse.json({ error: 'stashId and facilityId required' }, { status: 400 });
  if (fuel !== 'electricity' && fuel !== 'gas') {
    return NextResponse.json({ error: "fuel must be 'electricity' or 'gas'" }, { status: 400 });
  }

  // Facility access via RLS.
  const { data: facility } = await supabase.from('facilities').select('id').eq('id', facilityId).maybeSingle();
  if (!facility) return NextResponse.json({ error: 'Facility not accessible' }, { status: 403 });

  const admin = serviceClient();

  // Re-fetch the stashed CSV (stashId is the ingest-staging path).
  const { data: blob, error: dlError } = await admin.storage.from('ingest-staging').download(stashId);
  if (dlError || !blob) {
    return NextResponse.json({ error: 'Could not read the uploaded file (it may have expired). Please re-upload.' }, { status: 410 });
  }

  let result;
  try {
    result = await ingestHalfHourly(admin, { facilityId, fuel: fuel as Fuel, bytes: await blob.arrayBuffer(), resolution });
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
