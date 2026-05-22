import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export type AdminAuthSuccess = {
  ok: true;
  user: { id: string; email: string | null };
  /** Service-role client to write to admin tables + storage. */
  service: SupabaseClient;
  /** User-scoped client, useful for RLS-aware reads on the user's behalf. */
  userClient: SupabaseClient;
};

export type AdminAuthFailure = { ok: false; response: NextResponse };

/**
 * Resolve the alka**tera** admin context for an API route. Checks the
 * cookie session against `is_alkatera_admin()` RPC and returns a
 * service-role client for writes (admin already confirmed). All admin
 * API routes should call this at the top.
 */
export async function requireAlkateraAdmin(): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const userClient = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    };
  }
  const { data: isAdmin } = await userClient.rpc('is_alkatera_admin');
  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    };
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 }),
    };
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    service,
    userClient,
  };
}
