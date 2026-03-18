import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierFromPriceId, TIER_PRICING } from '@/lib/stripe-config';
import type Stripe from 'stripe';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '../_helpers/get-member-role';

/**
 * Proration Preview
 *
 * POST /api/stripe/proration-preview
 *
 * Returns a preview of what will be charged/credited when changing plans.
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

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
    const role = await getMemberRole(supabase, organizationId, user.id);
    if (!role) {
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
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id) as Stripe.Subscription;
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
    // Using type assertion due to Stripe SDK type definitions lagging behind the API
    const invoicePreview = await stripe.invoices.createPreview({
      customer: org.stripe_customer_id!,
      subscription: org.stripe_subscription_id,
      subscription_details: {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      },
    } as Parameters<typeof stripe.invoices.createPreview>[0]);

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
        periodEnd: subscription.items.data[0]?.current_period_end,
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
