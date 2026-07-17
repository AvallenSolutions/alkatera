import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOpenLCAClientForDatabase } from '@/lib/openlca/client';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export const dynamic = 'force-dynamic';

// The reference unit of a process never changes, so cache aggressively.
// Keyed by `${database}:${processId}`. Module-level: survives warm invocations.
const unitCache = new Map<string, string | null>();

/**
 * GET /api/openlca/reference-unit?process_id=...&database=ecoinvent|agribalyse
 *
 * Returns the unit of the process's quantitative reference flow, e.g.
 * { unit: "kg" } or { unit: "l" }. The process-descriptor list the search
 * uses doesn't carry units, so the picker fetches this on selection to stop
 * presenting every live factor as "per kg" when some are per litre/item/MJ.
 *
 * Returns { unit: null } when the process or its reference can't be read;
 * callers must treat null as "unknown", never as kg.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch } }
    );
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processId = request.nextUrl.searchParams.get('process_id');
    const database = (request.nextUrl.searchParams.get('database') || 'ecoinvent') as 'ecoinvent' | 'agribalyse';
    if (!processId) {
      return NextResponse.json({ error: 'process_id is required' }, { status: 400 });
    }
    if (database !== 'ecoinvent' && database !== 'agribalyse') {
      return NextResponse.json({ error: 'database must be ecoinvent or agribalyse' }, { status: 400 });
    }

    const cacheKey = `${database}:${processId}`;
    if (unitCache.has(cacheKey)) {
      return NextResponse.json({ unit: unitCache.get(cacheKey) });
    }

    const client = createOpenLCAClientForDatabase(database);
    if (!client) {
      return NextResponse.json({ unit: null, reason: 'database_not_configured' });
    }

    let unit: string | null = null;
    try {
      const proc = await client.getProcess(processId);
      const refExchange = proc.exchanges?.find((e) => e.quantitativeReference && !e.isInput)
        ?? proc.exchanges?.find((e) => e.quantitativeReference);
      unit = refExchange?.unit?.name ?? null;
    } catch (error) {
      console.warn(`[reference-unit] Failed to read process ${processId} (${database}):`, error);
      // Don't cache failures: the gdt-server may just be briefly unreachable.
      return NextResponse.json({ unit: null, reason: 'lookup_failed' });
    }

    unitCache.set(cacheKey, unit);
    return NextResponse.json({ unit });
  } catch (error) {
    console.error('[reference-unit] Unexpected error:', error);
    return NextResponse.json({ unit: null, reason: 'error' });
  }
}
