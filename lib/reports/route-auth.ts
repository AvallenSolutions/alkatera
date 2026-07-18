import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/**
 * Shared Bearer-token auth for the report API routes.
 *
 * Returns an RLS-scoped client built from the caller's session token, with
 * Next's fetch cache opted out (PostgREST selects are GETs, and on routes
 * that never touch next/headers the patched fetch would otherwise cache
 * them across invocations). Returns null when the Authorization header is
 * missing or malformed; callers respond 401.
 */

const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export function getAuthedClient(request: NextRequest): SupabaseClient | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch } }
  );
}
