import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { runSnapshotsSweep } from '@/lib/pulse/cron-jobs';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: Pulse — generate daily metric snapshots
 *
 * POST /api/cron/generate-snapshots
 *
 * Manual/admin trigger. In production this sweep runs on the
 * `pulseGenerateSnapshots` Inngest native cron
 * (lib/inngest/functions/pulse-jobs.ts, nightly ~02:00 UTC) — this route
 * calls the same `runSnapshotsSweep` for on-demand use.
 *
 * Protected by CRON_SECRET Bearer token.
 */

export const runtime = 'nodejs';
// Snapshot generation can take a minute or more for large workspaces.
export const maxDuration = 300;

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

    const result = await runSnapshotsSweep(supabase);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in generate-snapshots cron:', error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
  }
}
