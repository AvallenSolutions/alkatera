import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outreach/view  — body { token }
 *
 * Records the first time a prospect OPENS a report (Spec E telemetry). Fired by
 * a client beacon on /r/[token]. Deliberately only counts LOGGED-OUT opens: a
 * real prospect is never signed in, so this excludes our own admin previews and
 * the claimer revisiting their own report, keeping the open-rate honest.
 *
 * Public + unauthenticated by design; the unguessable token is the key, and the
 * worst case is stamping a timestamp on a report you already hold the link to.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  // Skip any authenticated viewer (admin preview / claimer revisit).
  try {
    const server = getSupabaseServerClient() as unknown as SupabaseClient;
    const { data } = await server.auth.getUser();
    if (data.user) {
      return NextResponse.json({ ok: true, counted: false });
    }
  } catch {
    // No session context — treat as an anonymous prospect view.
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ ok: true, counted: false });
  }

  // Stamp the first view only, and lift draft/sent -> viewed without ever
  // downgrading a report that has already been claimed.
  await (admin as any)
    .from('brand_reports')
    .update({ first_viewed_at: new Date().toISOString() })
    .eq('token', token)
    .is('first_viewed_at', null);

  await (admin as any)
    .from('brand_reports')
    .update({ status: 'viewed' })
    .eq('token', token)
    .in('status', ['draft', 'sent']);

  return NextResponse.json({ ok: true, counted: true });
}
