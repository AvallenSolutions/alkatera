import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { syncWikiToKnowledgeBase } from '@/lib/wiki-sync';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: sync the wiki into Rosa's knowledge base
 *
 * POST /api/cron/sync-wiki-to-rosa
 *
 * Invoked by netlify/functions/deploy-succeeded.ts after every successful
 * production deploy, so Rosa always serves the wiki content that is actually
 * live. Idempotent full replace of the 'wiki' category; safe to re-run.
 *
 * Protected by CRON_SECRET Bearer token, same pattern as the other crons.
 * wiki/pages is traced into this route's bundle via next.config.js.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });

  try {
    const result = await syncWikiToKnowledgeBase(service);
    console.log(`Wiki -> Rosa sync: ${result.synced} pages at ${result.lastSyncedAt}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.error('Wiki -> Rosa sync failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
