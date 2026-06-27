/**
 * POST /api/utilities/smart-meter-conflict
 *
 * Pre-flight for the client-side utility writers (manual entry, rollover copy,
 * Rosa) so the "enter consumption once" rule holds everywhere. Mirrors the check
 * baked into save-bill and the smart-meter upload.
 *
 * Body: { facilityId, utilityTypes: string[], periodStart, periodEnd, action? }
 *  - no action  → { conflict, existing }   (does smart-meter data overlap?)
 *  - action:'replace' → removes the overlapping smart-meter data (derived rows +
 *    half-hourly detail), so the caller can then save its bill/manual entry.
 *
 * Access to the facility is checked with the user client (RLS); the removal runs
 * with the service client (smart_meter_readings is service-write).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { findSmartMeterOverlap, removeSmartMeterData } from '@/lib/energy/smart-meter-conflict';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const facilityId = body?.facilityId as string;
  const utilityTypes = Array.isArray(body?.utilityTypes) ? (body.utilityTypes as string[]) : null;
  const periodStart = body?.periodStart as string;
  const periodEnd = body?.periodEnd as string;
  const action = body?.action as string | undefined;

  if (!facilityId || !utilityTypes || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'facilityId, utilityTypes, periodStart, periodEnd required' }, { status: 400 });
  }

  // Facility access via RLS.
  const { data: facility } = await client.from('facilities').select('id').eq('id', facilityId).maybeSingle();
  if (!facility) return NextResponse.json({ error: 'Facility not accessible' }, { status: 403 });

  const admin = serviceClient();

  if (action === 'replace') {
    await removeSmartMeterData(admin, facilityId, utilityTypes, periodStart, periodEnd);
    return NextResponse.json({ ok: true, removed: true });
  }

  const existing = await findSmartMeterOverlap(admin, facilityId, utilityTypes, periodStart, periodEnd);
  return NextResponse.json({ conflict: existing.length > 0, existing }, { headers: { 'Cache-Control': 'no-store' } });
}
