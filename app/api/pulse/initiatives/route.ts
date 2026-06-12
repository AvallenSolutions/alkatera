import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ABATEMENT_LEVERS } from '@/lib/pulse/abatement-costs';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { recalculateBcorpForInitiativeOrg } from '@/lib/certifications/recalculate';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';

/**
 * GET    /api/pulse/initiatives?organization_id=...   list initiatives + target links
 * POST   /api/pulse/initiatives                        create (always as draft)
 * PATCH  /api/pulse/initiatives                        edit fields / progress / target links
 * DELETE /api/pulse/initiatives?id=...                 delete (owner/admin only)
 *
 * Auth: cookie-based Supabase SSR client, same as the sibling targets route.
 * RLS enforces org membership; the status-transition guard lives in a DB
 * trigger plus the dedicated transition route. After any change that could
 * affect B Corp climate evidence we refresh readiness best-effort.
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

function refreshBcorp(organizationId: string) {
  // Best-effort, never blocks the response.
  try {
    const admin = getSupabaseAdminClient();
    void recalculateBcorpForInitiativeOrg(admin, organizationId);
  } catch (err) {
    console.error('[initiatives] B Corp refresh failed:', err);
  }
}

const EDITABLE_FIELDS = [
  'title', 'description', 'lever_id',
  'owner_user_id', 'owner_name',
  'start_date', 'end_date',
  'budget_estimated_gbp', 'budget_approved_gbp', 'budget_spent_gbp',
  'expected_annual_reduction_value', 'expected_annual_reduction_unit',
  'actual_impact_notes',
] as const;

const PROGRESS_FIELDS = ['percent_complete', 'progress_notes'] as const;

export async function GET(request: NextRequest) {
  const orgId = new URL(request.url).searchParams.get('organization_id');
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  }
  const supabase = getClient();
  const { data, error } = await supabase
    .from('reduction_initiatives')
    .select('*, initiative_target_links(target_id)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Viewer's role so the UI can show/hide approval controls (server-side
  // enforcement still happens in the transition route + DB trigger).
  const { data: userData } = await supabase.auth.getUser();
  let viewerRole: string | null = null;
  if (userData?.user) {
    viewerRole = await getMemberRole(supabase as any, orgId, userData.user.id);
  }

  return NextResponse.json({ initiatives: data ?? [], viewerRole });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.organization_id || !body.title) {
    return NextResponse.json({ error: 'organization_id and title required' }, { status: 400 });
  }
  if (body.lever_id && !ABATEMENT_LEVERS.some((l) => l.id === body.lever_id)) {
    return NextResponse.json({ error: 'Unknown lever_id' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const insert: Record<string, unknown> = {
    organization_id: body.organization_id,
    status: 'draft',
    created_by: userData.user.id,
  };
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) insert[f] = body[f];
  }

  const { data: initiative, error } = await supabase
    .from('reduction_initiatives')
    .insert(insert)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targetIds: string[] = Array.isArray(body.target_ids) ? body.target_ids : [];
  if (targetIds.length > 0) {
    const { error: linkError } = await supabase
      .from('initiative_target_links')
      .insert(targetIds.map((target_id) => ({ initiative_id: initiative.id, target_id })));
    if (linkError) {
      console.error('[initiatives] target link insert failed:', linkError.message);
    }
  }

  refreshBcorp(body.organization_id);
  return NextResponse.json({ initiative });
}

export async function PATCH(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (body.lever_id && !ABATEMENT_LEVERS.some((l) => l.id === body.lever_id)) {
    return NextResponse.json({ error: 'Unknown lever_id' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) update[f] = body[f];
  }
  let progressTouched = false;
  for (const f of PROGRESS_FIELDS) {
    if (body[f] !== undefined) {
      update[f] = body[f];
      progressTouched = true;
    }
  }
  if (progressTouched) update.progress_updated_at = new Date().toISOString();

  const { data: initiative, error } = await supabase
    .from('reduction_initiatives')
    .update(update)
    .eq('id', body.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(body.target_ids)) {
    await supabase.from('initiative_target_links').delete().eq('initiative_id', body.id);
    if (body.target_ids.length > 0) {
      const { error: linkError } = await supabase
        .from('initiative_target_links')
        .insert(body.target_ids.map((target_id: string) => ({ initiative_id: body.id, target_id })));
      if (linkError) {
        console.error('[initiatives] target link update failed:', linkError.message);
      }
    }
  }

  refreshBcorp(initiative.organization_id);
  return NextResponse.json({ initiative });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch first so we know the org for the role check + B Corp refresh.
  const { data: initiative } = await supabase
    .from('reduction_initiatives')
    .select('id, organization_id')
    .eq('id', id)
    .maybeSingle();
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = await getMemberRole(supabase as any, initiative.organization_id, userData.user.id);
  if (!role || !['owner', 'admin'].includes(role.toLowerCase())) {
    return NextResponse.json({ error: 'Only an organisation owner or admin can delete an initiative' }, { status: 403 });
  }

  const { error } = await supabase.from('reduction_initiatives').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  refreshBcorp(initiative.organization_id);
  return NextResponse.json({ ok: true });
}
