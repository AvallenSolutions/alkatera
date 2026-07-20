import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { resetDrinksCoDemo, seedDrinksCoDemo } from '@/lib/demo-seed/drinks-co';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Build (or reset) the complete alkatera Drinks Co demo dataset. Admin-only,
 * service-role, idempotent. Targets the fixed Drinks Co org id inside the
 * seeder, so no org is accepted from the client.
 */

const BodySchema = z.object({ action: z.enum(['seed', 'reset']).default('seed') });

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

async function assertAdmin(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401, error: 'Unauthorised' };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return { ok: false, status: 401, error: 'Unauthorised' };
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin');
  if (isAdmin !== true) return { ok: false, status: 403, error: 'Admin only' };
  return { ok: true };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStoreFetch } });
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const svc = serviceClient();
  try {
    const result = parsed.data.action === 'reset' ? await resetDrinksCoDemo(svc) : await seedDrinksCoDemo(svc);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Seed failed' }, { status: 500 });
  }
}
