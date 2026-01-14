import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db_types';

/**
 * Get Subscription History
 *
 * GET /api/stripe/subscription-history?organizationId=xxx
 *
 * Returns the subscription change history for an organization.
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Verify user is a member of the organization
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get subscription history
    const { data: history, error: historyError, count } = await supabase
      .from('subscription_history')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (historyError) {
      console.error('Error fetching subscription history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription history' },
        { status: 500 }
      );
    }

    // Format the history entries
    const formattedHistory = history.map((entry) => ({
      id: entry.id,
      eventType: entry.event_type,
      previousTier: entry.previous_tier,
      newTier: entry.new_tier,
      previousStatus: entry.previous_status,
      newStatus: entry.new_status,
      amountCharged: entry.amount_charged,
      amountCredited: entry.amount_credited,
      currency: entry.currency,
      stripeInvoiceId: entry.stripe_invoice_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
      eventTypeLabel: getEventTypeLabel(entry.event_type),
    }));

    return NextResponse.json({
      history: formattedHistory,
      total: count,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error getting subscription history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subscription history' },
      { status: 500 }
    );
  }
}

function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    upgrade: 'Plan Upgraded',
    downgrade: 'Plan Downgraded',
    cancellation: 'Subscription Cancelled',
    reactivation: 'Subscription Reactivated',
    payment_failed: 'Payment Failed',
    payment_succeeded: 'Payment Successful',
    grace_period_started: 'Grace Period Started',
    grace_period_ended: 'Grace Period Ended',
    grace_period_auto_deletion: 'Items Auto-Deleted',
  };
  return labels[eventType] || eventType;
}
