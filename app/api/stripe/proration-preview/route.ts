import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { stripe, getTierFromPriceId, TIER_PRICING } from '@/lib/stripe-config';
import type { Database } from '@/types/db_types';

/**
 * Proration Preview
 *
 * POST /api/stripe/proration-preview
 *
 * Returns a preview of what will be charged/credited when changing plans.
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, newPriceId } = body;

    if (!organizationId || !newPriceId) {
      return NextResponse.json(
        { error: 'Organization ID and new price ID are required' },
        { status: 400 }
      );
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

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // If no existing subscription, return the full price
    if (!org.stripe_subscription_id) {
      const newTier = getTierFromPriceId(newPriceId);
      const tierPricing = TIER_PRICING[newTier];
      const isAnnual = newPriceId === tierPricing.annualPriceId;
      const amount = isAnnual ? tierPricing.annualPrice : tierPricing.monthlyPrice;

      return NextResponse.json({
        proration: {
          currentPlanCredit: 0,
          newPlanCost: amount * 100, // Convert to pence
          netAmount: amount * 100,
          currency: 'gbp',
          isUpgrade: true,
          immediateCharge: amount * 100,
          periodEnd: null,
        },
      });
    }

    // Get the current subscription
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    const currentPriceId = subscription.items.data[0]?.price.id;

    if (!currentPriceId) {
      return NextResponse.json({ error: 'Current subscription has no price' }, { status: 400 });
    }

    // Get the current and new tier info
    const currentTier = getTierFromPriceId(currentPriceId);
    const newTier = getTierFromPriceId(newPriceId);
    const currentTierLevel = currentTier === 'seed' ? 1 : currentTier === 'blossom' ? 2 : 3;
    const newTierLevel = newTier === 'seed' ? 1 : newTier === 'blossom' ? 2 : 3;
    const isUpgrade = newTierLevel > currentTierLevel;

    // Create an invoice preview with proration
    const invoicePreview = await stripe.invoices.createPreview({
      customer: org.stripe_customer_id!,
      subscription: org.stripe_subscription_id,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      subscription_proration_behavior: 'create_prorations',
    });

    // Calculate the proration amounts
    let currentPlanCredit = 0;
    let newPlanCost = 0;

    for (const line of invoicePreview.lines.data) {
      if (line.amount < 0) {
        currentPlanCredit += Math.abs(line.amount);
      } else {
        newPlanCost += line.amount;
      }
    }

    const netAmount = newPlanCost - currentPlanCredit;

    return NextResponse.json({
      proration: {
        currentPlanCredit,
        newPlanCost,
        netAmount,
        currency: invoicePreview.currency,
        isUpgrade,
        immediateCharge: netAmount > 0 ? netAmount : 0,
        credit: netAmount < 0 ? Math.abs(netAmount) : 0,
        periodEnd: subscription.current_period_end,
        currentTier,
        newTier,
      },
    });
  } catch (error: any) {
    console.error('Error getting proration preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get proration preview' },
      { status: 500 }
    );
  }
}
