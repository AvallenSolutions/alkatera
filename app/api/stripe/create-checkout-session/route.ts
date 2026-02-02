import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierFromPriceId, getBillingIntervalFromPriceId, getPriceId, type SubscriptionTier, type BillingInterval } from '@/lib/stripe-config';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

/**
 * Create Stripe Checkout Session
 *
 * POST /api/stripe/create-checkout-session
 *
 * Body (Option 1):
 * - priceId: Stripe price ID
 * - organizationId: Organization ID to associate the subscription with
 *
 * Body (Option 2):
 * - tierName: Subscription tier name (seed, blossom, canopy)
 * - billingInterval: Billing interval (monthly, annual)
 * - organizationId: Organization ID to associate the subscription with
 *
 * Returns:
 * - url: Stripe Checkout session URL to redirect the user to
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Checkout] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Checkout] User authenticated:', user.id);

    // Parse request body
    const body = await request.json();
    const { priceId: directPriceId, tierName, billingInterval: requestedInterval, organizationId } = body;

    console.log('[Checkout] Request:', { directPriceId, tierName, requestedInterval, organizationId });

    // Determine priceId - either directly provided or derived from tier/interval
    let priceId = directPriceId;
    if (!priceId && tierName && requestedInterval) {
      priceId = getPriceId(tierName as SubscriptionTier, requestedInterval as BillingInterval);
    }

    if (!priceId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: (priceId OR tierName+billingInterval) and organizationId' },
        { status: 400 }
      );
    }

    // Verify user has permission to manage billing for this organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('role_id, roles(name)')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    console.log('[Checkout] Member check:', { memberData, memberError });

    if (memberError || !memberData) {
      console.error('[Checkout] Member error:', memberError);
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Check if user is admin or owner
    const roleName = (memberData as any).roles?.name;
    console.log('[Checkout] Role name:', roleName);

    if (roleName !== 'admin' && roleName !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization admins or owners can manage billing' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single();

    console.log('[Checkout] Organization query:', { org, orgError });

    if (orgError) {
      console.error('[Checkout] Error fetching organization:', orgError);
      return NextResponse.json({
        error: 'Organization not found',
        details: orgError.message
      }, { status: 404 });
    }

    if (!org) {
      console.error('Organization not found for ID:', organizationId);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const customerEmail = profile?.email || user.email;

    // Get tier and billing interval from price ID
    const tier = getTierFromPriceId(priceId);
    const interval = getBillingIntervalFromPriceId(priceId);

    // Create or retrieve Stripe customer
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          organizationId: org.id,
          organizationName: org.name,
        },
      });
      customerId = customer.id;

      // Update organization with customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id);
    }

    // Get the base URL for redirects (use custom domain if available)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/complete-subscription?success=true&tier=${tier}`,
      cancel_url: `${baseUrl}/complete-subscription?canceled=true`,
      metadata: {
        organizationId: org.id,
        tier,
        billingInterval: interval,
      },
      subscription_data: {
        metadata: {
          organizationId: org.id,
          tier,
          billingInterval: interval,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
