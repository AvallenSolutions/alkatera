import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * GET /api/pulse/targets?organization_id=...   list active targets
 * POST /api/pulse/targets                       create a target
 *
 * Auth: cookie-based via Supabase SSR client. RLS enforces that only org
 * admins/owners can create targets and members can read them.
 */
export const runtime = 'nodejs';

function getClient() {
  const cookieStore = cookies();
  return createServerClient(
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
}

export async function GET(request: NextRequest) {
  const orgId = new URL(request.url).searchParams.get('organization_id');
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  }
  const supabase = getClient();
  const { data, error } = await supabase
    .from('sustainability_targets')
    .select('*')
    .eq('organization_id', orgId)
    .order('target_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const required = ['organization_id', 'metric_key', 'baseline_value', 'baseline_date', 'target_value', 'target_date'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return NextResponse.json({ error: `${field} required` }, { status: 400 });
    }
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('sustainability_targets')
    .insert({
      organization_id: body.organization_id,
      metric_key: body.metric_key,
      baseline_value: Number(body.baseline_value),
      baseline_date: body.baseline_date,
      target_value: Number(body.target_value),
      target_date: body.target_date,
      scope: body.scope ?? null,
      methodology: body.methodology ?? null,
      notes: body.notes ?? null,
      created_by: userData.user.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ target: data });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = getClient();
  const { error } = await supabase.from('sustainability_targets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
