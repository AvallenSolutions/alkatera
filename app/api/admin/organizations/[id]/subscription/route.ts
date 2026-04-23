import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    const body = await request.json();
    const { subscription_tier, subscription_status } = body as {
      subscription_tier?: string;
      subscription_status?: string;
    };

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
      .select('id, subscription_started_at')
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

    return NextResponse.json({ organization: updated });
  } catch (error: unknown) {
    console.error('Error updating subscription:', error);
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
