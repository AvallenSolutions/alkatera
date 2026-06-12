import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  canTransition,
  ACTION_RESULT,
  type InitiativeAction,
  type InitiativeStatus,
} from '@/lib/pulse/initiative-status';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { recalculateBcorpForInitiativeOrg } from '@/lib/certifications/recalculate';
import { getMemberRole } from '@/app/api/stripe/_helpers/get-member-role';

/**
 * POST /api/pulse/initiatives/transition
 * Body: { id: string, action: 'submit'|'approve'|'reject'|'complete'|'cancel', reason?: string }
 *
 * Moves an initiative through the approval workflow. Permissions are checked
 * here via canTransition() and again by the database trigger
 * (enforce_initiative_status_transition), so a direct client call cannot
 * bypass the gate either.
 */
export const runtime = 'nodejs';

const ACTIONS: InitiativeAction[] = ['submit', 'approve', 'reject', 'complete', 'cancel'];

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

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, action, reason } = body as { id?: string; action?: InitiativeAction; reason?: string };
  if (!id || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'id and a valid action required' }, { status: 400 });
  }

  const supabase = getClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: initiative } = await supabase
    .from('reduction_initiatives')
    .select('id, organization_id, status, owner_user_id, created_by')
    .eq('id', id)
    .maybeSingle();
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = await getMemberRole(supabase as any, initiative.organization_id, userId);
  const isOwner = userId === initiative.owner_user_id || userId === initiative.created_by;

  if (!canTransition(action, initiative.status as InitiativeStatus, role, isOwner)) {
    return NextResponse.json(
      { error: 'You cannot make this change. Approvals need an organisation owner or admin.' },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: ACTION_RESULT[action],
    updated_at: now,
  };
  if (action === 'submit') {
    update.submitted_by = userId;
    update.submitted_at = now;
    update.rejection_reason = null;
  }
  if (action === 'approve') {
    update.approved_by = userId;
    update.approved_at = now;
    update.rejection_reason = null;
  }
  if (action === 'reject') {
    update.rejection_reason = reason || 'No reason given';
  }

  const { data: updated, error } = await supabase
    .from('reduction_initiatives')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Status changes are exactly what flips B Corp climate-plan evidence.
  try {
    const admin = getSupabaseAdminClient();
    void recalculateBcorpForInitiativeOrg(admin, initiative.organization_id);
  } catch (err) {
    console.error('[initiatives/transition] B Corp refresh failed:', err);
  }

  return NextResponse.json({ initiative: updated });
}
