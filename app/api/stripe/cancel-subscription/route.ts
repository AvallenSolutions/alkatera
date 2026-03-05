import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe-config';
import type { Database } from '@/types/db_types';

/**
 * Cancel Subscription
 *
 * POST /api/stripe/cancel-subscription
 *
 * Cancels the organisation's Stripe subscription at the end of the current
 * billing period. The subscription remains active until the period ends,
 * at which point the Stripe webhook (customer.subscription.deleted) will
 * downgrade the organisation to the Seed tier.
 */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organisation ID is required' }, { status: 400 });
    }

    // Verify user is a member of the organisation with appropriate role
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can cancel subscriptions' },
        { status: 403 }
      );
    }

    // Get organisation's Stripe subscription ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_subscription_id, stripe_customer_id, subscription_tier, subscription_status')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    if (!org.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    if (org.subscription_tier === 'seed') {
      return NextResponse.json(
        { error: 'You are already on the free Seed plan' },
        { status: 400 }
      );
    }

    // Cancel at end of billing period (not immediately)
    const subscription = await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Extract cancel_at from the response (cast to access Stripe fields)
    const subData = subscription as any;
    const cancelTimestamp = subData.cancel_at || subData.current_period_end;

    return NextResponse.json({
      success: true,
      cancelAt: cancelTimestamp
        ? new Date(cancelTimestamp * 1000).toISOString()
        : null,
    });
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
