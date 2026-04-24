/**
 * Cron: Pulse -- refresh global shadow prices
 *
 * POST /api/cron/refresh-shadow-prices
 *
 * Runs quarterly (1 Jan, 1 Apr, 1 Jul, 1 Oct at 08:00 UTC).
 * Reads the canonical reference prices from lib/pulse/reference-shadow-prices.ts
 * and upserts global rows (organization_id IS NULL) into org_shadow_prices with
 * today's effective_from date.
 *
 * "Global rows" are the platform-wide defaults every org inherits unless they've
 * set an org-specific override on the Prices settings page.
 *
 * To update prices for the next quarter:
 *   1. Edit lib/pulse/reference-shadow-prices.ts
 *   2. Change REFERENCE_QUARTER and the price_per_unit / source values
 *   3. Commit and deploy -- this cron will pick up the new values automatically
 *
 * Protected by CRON_SECRET Bearer token (same pattern as other cron routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { REFERENCE_PRICES, REFERENCE_QUARTER } from '@/lib/pulse/reference-shadow-prices';

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
    });

    const today = new Date().toISOString().slice(0, 10);

    // Upsert each reference price as a global row (organization_id = null).
    // The unique constraint is (organization_id, metric_key, currency, effective_from)
    // so multiple runs on the same day are safe -- they update rather than duplicate.
    const rows = REFERENCE_PRICES.map(p => ({
      organization_id: null,
      metric_key: p.metric_key,
      currency: p.currency,
      price_per_unit: p.price_per_unit,
      unit: p.unit,
      native_unit_multiplier: p.native_unit_multiplier,
      source: p.source,
      effective_from: today,
    }));

    const { error } = await supabase
      .from('org_shadow_prices')
      .upsert(rows, {
        onConflict: 'organization_id,metric_key,currency,effective_from',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[cron refresh-shadow-prices] upsert failed:', error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    console.log(
      `[cron refresh-shadow-prices] updated ${rows.length} global prices for ${REFERENCE_QUARTER} (effective ${today})`,
    );

    return NextResponse.json({
      ok: true,
      quarter: REFERENCE_QUARTER,
      effective_from: today,
      updated: rows.map(r => ({
        metric_key: r.metric_key,
        price_per_unit: r.price_per_unit,
        currency: r.currency,
        source: r.source,
      })),
    });
  } catch (err: any) {
    console.error('[cron refresh-shadow-prices]', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
