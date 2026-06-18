import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Both fields optional here; the enum validation + "at least one"
// requirement stay in the handler to preserve their specific messages.
const SubscriptionPatchSchema = z
  .object({
    subscription_tier: z.string().optional(),
    subscription_status: z.string().optional(),
  })
  .strict();

const ALLOWED_TIERS = ['seed', 'blossom', 'canopy'] as const;
const ALLOWED_STATUSES = ['active', 'trial', 'pending', 'past_due', 'suspended', 'cancelled'] as const;

type Tier = typeof ALLOWED_TIERS[number];
type Status = typeof ALLOWED_STATUSES[number];

/**
 * PATCH /api/admin/organizations/[id]/subscription
 * Update an organisation's subscription tier and/or status.
 * Body: { subscription_tier?: Tier, subscription_status?: Status }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsed = SubscriptionPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { subscription_tier, subscription_status } = parsed.data;

    if (!subscription_tier && !subscription_status) {
      return NextResponse.json(
        { error: 'At least one of subscription_tier or subscription_status is required' },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};

    if (subscription_tier !== undefined) {
      if (!ALLOWED_TIERS.includes(subscription_tier as Tier)) {
        return NextResponse.json(
          { error: `Invalid tier. Must be one of: ${ALLOWED_TIERS.join(', ')}` },
          { status: 400 }
        );
      }
      update.subscription_tier = subscription_tier;
    }

    if (subscription_status !== undefined) {
      if (!ALLOWED_STATUSES.includes(subscription_status as Status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      update.subscription_status = subscription_status;
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing, error: fetchError } = await adminClient
      .from('organizations')
      .select('id, name, subscription_tier, subscription_status, subscription_started_at')
      .eq('id', params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    if (update.subscription_tier && !existing.subscription_started_at) {
      update.subscription_started_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await adminClient
      .from('organizations')
      .update(update)
      .eq('id', params.id)
      .select('id, name, subscription_tier, subscription_status, subscription_started_at, subscription_expires_at')
      .single();

    if (updateError) throw updateError;

    // Audit trail: record who changed what (actor derived server-side in the RPC).
    // Non-fatal: an audit hiccup must not fail the admin action.
    try {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (subscription_tier !== undefined && subscription_tier !== existing.subscription_tier) {
        changes.tier = { from: existing.subscription_tier, to: subscription_tier };
      }
      if (subscription_status !== undefined && subscription_status !== existing.subscription_status) {
        changes.status = { from: existing.subscription_status, to: subscription_status };
      }
      if (Object.keys(changes).length > 0) {
        await (supabase.rpc as any)('log_admin_action', {
          p_action: 'org.subscription_update',
          p_target_type: 'organization',
          p_target_id: params.id,
          p_target_label: existing.name ?? updated?.name ?? null,
          p_metadata: changes,
        });
      }
    } catch (logErr) {
      console.warn('[audit] failed to log org.subscription_update', logErr);
    }

    return NextResponse.json({ organization: updated });
  } catch (error: unknown) {
    console.error('Error updating subscription:', error);
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
