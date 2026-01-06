import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierFromPriceId, getBillingIntervalFromPriceId } from '@/lib/stripe-config';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

/**
 * Create Stripe Checkout Session
 *
 * POST /api/stripe/create-checkout-session
 *
 * Body:
 * - priceId: Stripe price ID
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { priceId, organizationId } = body;

    if (!priceId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: priceId and organizationId' },
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

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // Check if user is admin or owner
    const roleName = (memberData as any).roles?.name;
    if (roleName !== 'admin' && roleName !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization admins or owners can manage billing' },
        { status: 403 }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id, billing_email')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const customerEmail = org.billing_email || profile?.email || user.email;

    // Get tier and billing interval from price ID
    const tier = getTierFromPriceId(priceId);
    const billingInterval = getBillingIntervalFromPriceId(priceId);

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
      success_url: `${request.nextUrl.origin}/settings/billing?success=true&tier=${tier}`,
      cancel_url: `${request.nextUrl.origin}/settings/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        tier,
        billingInterval,
      },
      subscription_data: {
        metadata: {
          organizationId: org.id,
          tier,
          billingInterval,
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
