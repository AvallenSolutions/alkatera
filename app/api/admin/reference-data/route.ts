/**
 * Admin: external reference-data loaders (Foundation A).
 *
 * GET  /api/admin/reference-data  — per-loader status: whether its current
 *      version is loaded, how many factors are present, when it was loaded.
 * POST /api/admin/reference-data  — dispatch the background Inngest job that
 *      loads a release. Body: { loaderKey: string }.
 *
 * Admin-gated via is_alkatera_admin (Bearer token), mirroring the Agribalyse
 * backfill route. The load runs in Inngest, never in this request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { listLoaders, getLoader } from '@/lib/external-data/registry';

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

  const loaders = await Promise.all(
    listLoaders().map(async (loader) => {
      const { spec } = loader;
      // Is this exact version present, and is it the current (valid_to null) one?
      const { data: set } = await admin
        .from('factor_sets')
        .select('id, version, valid_from, valid_to, created_at')
        .eq('provider', spec.provider)
        .eq('dataset', spec.dataset)
        .eq('version', spec.version)
        .maybeSingle();

      let factorCount = 0;
      if (set?.id) {
        const { count } = await admin
          .from('reference_factors')
          .select('id', { count: 'exact', head: true })
          .eq('factor_set_id', set.id);
        factorCount = count ?? 0;
      }

      return {
        key: loader.key,
        label: loader.label,
        description: loader.description,
        provider: spec.provider,
        dataset: spec.dataset,
        version: spec.version,
        licence: spec.licence,
        sourceUrl: spec.sourceUrl ?? null,
        loaded: !!set?.id,
        isCurrent: !!set?.id && set?.valid_to == null,
        loadedAt: set?.created_at ?? null,
        factorCount,
      };
    }),
  );

  return NextResponse.json({ loaders }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if ('error' in ctx) return ctx.error;

  let loaderKey: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.loaderKey === 'string') loaderKey = body.loaderKey;
  } catch {
    // fall through to validation below
  }

  if (!loaderKey || !getLoader(loaderKey)) {
    return NextResponse.json({ error: 'Unknown or missing loaderKey' }, { status: 400 });
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: 'Background job queue (Inngest) is not configured in this environment.' },
      { status: 503 },
    );
  }

  try {
    await inngest.send({ name: 'reference-data/load.requested', data: { loaderKey } });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to enqueue load job' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, dispatched: true, loaderKey }, { status: 202 });
}
