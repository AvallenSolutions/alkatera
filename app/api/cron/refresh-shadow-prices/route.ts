/**
 * Cron: Pulse -- refresh global shadow prices
 *
 * POST /api/cron/refresh-shadow-prices
 *
 * Manual/admin trigger. In production this sweep runs on the
 * `pulseRefreshShadowPrices` Inngest native cron (lib/inngest/functions/pulse-jobs.ts,
 * quarterly: 1 Jan, 1 Apr, 1 Jul, 1 Oct at 08:00 UTC) -- this route calls the
 * same `runShadowPriceRefresh` for on-demand use.
 *
 * Reads the canonical reference prices from lib/pulse/reference-shadow-prices.ts
 * and upserts global rows (organization_id IS NULL) into org_shadow_prices with
 * today's effective_from date.
 *
 * To update prices for the next quarter:
 *   1. Edit lib/pulse/reference-shadow-prices.ts
 *   2. Change REFERENCE_QUARTER and the price_per_unit / source values
 *   3. Commit and deploy -- the cron picks up the new values automatically
 *
 * Protected by CRON_SECRET Bearer token (same pattern as other cron routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { runShadowPriceRefresh } from '@/lib/pulse/cron-jobs';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: noStoreFetch },
    });

    const result = await runShadowPriceRefresh(supabase);
    console.log(
      `[cron refresh-shadow-prices] updated ${result.updated.length} global prices for ${result.quarter} (effective ${result.effective_from})`,
    );
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[cron refresh-shadow-prices]', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
