import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { processAlkateraSyncQueue } from '@/lib/distributor/integration/alkatera-sync-queue';

/**
 * Cron: drain the alkatera_sync_queue.
 *
 * POST /api/cron/process-alkatera-sync-queue
 *
 * Manual/admin trigger. In production this drains on the
 * `alkateraSyncQueueTick` Inngest native cron
 * (lib/inngest/functions/distributor-cron.ts, every 1 minute) — this route
 * calls the same `processAlkateraSyncQueue` for on-demand use.
 *
 * Auth: CRON_SECRET Bearer.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return processQueue(request);
}

// GET allowed too so an operator can hit it manually from the browser
// while logged in; the auth check is identical.
export async function GET(request: NextRequest) {
  return processQueue(request);
}

async function processQueue(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  try {
    const result = await processAlkateraSyncQueue(supabase);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
