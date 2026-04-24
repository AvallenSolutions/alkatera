import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * GET  /api/pulse/layout?organization_id=...   Read the caller's saved layout.
 * PUT  /api/pulse/layout                       Upsert the caller's layout.
 *      body: { organization_id, layout, hidden_widgets }
 * DELETE /api/pulse/layout?organization_id=... Reset to default (deletes the row).
 *
 * RLS pins all rows to the calling user, so no extra org-membership check is
 * required (the unique constraint + policy means you can only ever touch
 * your own row).
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
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('dashboard_layouts')
    .select('layout, hidden_widgets, updated_at')
    .eq('user_id', userData.user.id)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ layout: data?.layout ?? null, hidden_widgets: data?.hidden_widgets ?? [] });
}

export async function PUT(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.organization_id || !body.layout) {
    return NextResponse.json({ error: 'organization_id and layout required' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert(
      {
        user_id: userData.user.id,
        organization_id: body.organization_id,
        layout: body.layout,
        hidden_widgets: body.hidden_widgets ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,organization_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const orgId = new URL(request.url).searchParams.get('organization_id');
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('dashboard_layouts')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('organization_id', orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
