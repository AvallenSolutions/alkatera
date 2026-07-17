/**
 * Admin: Agribalyse food-factor backfill.
 *
 * GET  /api/admin/agribalyse-backfill  — coverage stats (how many target factors
 *      are already present), so the admin UI can show progress.
 * POST /api/admin/agribalyse-backfill  — dispatch the background Inngest job that
 *      calculates + upserts the factors. Body: { names?: string[] } to limit to a
 *      subset (default: all targets).
 *
 * Admin-gated via is_alkatera_admin (Bearer token), mirroring the beta-access
 * admin route. The heavy work runs in Inngest, never in this request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { isAgribalyseConfigured } from '@/lib/openlca/client';
import { BACKFILL_TARGET_COUNT } from '@/lib/openlca/agribalyse-backfill';

export const dynamic = 'force-dynamic';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
  });

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin');
  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { global: { fetch: noStoreFetch } });
  return { admin };
}

export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ count: agribalyseCount }, { count: ingredientCount }] = await Promise.all([
    admin
      .from('staging_emission_factors')
      .select('id', { count: 'exact', head: true })
      .like('source', 'Agribalyse%'),
    admin
      .from('staging_emission_factors')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'Ingredient'),
  ]);

  return NextResponse.json(
    {
      configured: isAgribalyseConfigured(),
      targetCount: BACKFILL_TARGET_COUNT,
      agribalyseFactorCount: agribalyseCount ?? 0,
      ingredientFactorCount: ingredientCount ?? 0,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if ('error' in ctx) return ctx.error;

  if (!isAgribalyseConfigured()) {
    return NextResponse.json(
      { error: 'Agribalyse server is not configured (OPENLCA_AGRIBALYSE_SERVER_URL).' },
      { status: 400 },
    );
  }

  // The backfill runs on Inngest; without an event key we can't enqueue it.
  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: 'Background job queue (Inngest) is not configured in this environment.' },
      { status: 503 },
    );
  }

  let names: string[] | undefined;
  try {
    const body = await request.json();
    if (Array.isArray(body?.names)) names = body.names.map(String);
  } catch {
    // No body / not JSON — run the full backfill.
  }

  try {
    await inngest.send({ name: 'factors/agribalyse.backfill', data: { names } });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to enqueue backfill job' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, dispatched: true }, { status: 202 });
}
