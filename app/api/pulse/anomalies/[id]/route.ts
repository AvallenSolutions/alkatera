import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * PATCH /api/pulse/anomalies/[id]   { action: 'acknowledge' | 'dismiss', notes?: string }
 *
 * Lets a member of the org transition an open anomaly to acknowledged or
 * dismissed (the latter feeds back into baseline calc to suppress similar
 * future false positives).
 */
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { action?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.action !== 'acknowledge' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be acknowledge or dismiss' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const update: Record<string, any> =
    body.action === 'acknowledge'
      ? {
          status: 'acknowledged',
          acknowledged_by: userData.user.id,
          acknowledged_at: new Date().toISOString(),
          notes: body.notes ?? null,
        }
      : {
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          notes: body.notes ?? null,
        };

  const { error } = await supabase.from('dashboard_anomalies').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
