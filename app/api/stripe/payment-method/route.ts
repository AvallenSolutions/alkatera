import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe-config';
import type { Database } from '@/types/db_types';

export const dynamic = 'force-dynamic';

/**
 * Get Payment Method Details
 *
 * GET /api/stripe/payment-method?organizationId=xxx
 *
 * Returns the default payment method details for a Stripe customer.
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

    // Get organization's Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json({ paymentMethod: null });
    }

    // Get the customer from Stripe
    const customer = await stripe.customers.retrieve(org.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    });

    if (customer.deleted) {
      return NextResponse.json({ paymentMethod: null });
    }

    // Get the default payment method
    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethod || typeof defaultPaymentMethod === 'string') {
      // Try to get from subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: org.stripe_customer_id,
        limit: 1,
        expand: ['data.default_payment_method'],
      });

      if (subscriptions.data.length > 0) {
        const subPaymentMethod = subscriptions.data[0].default_payment_method;
        if (subPaymentMethod && typeof subPaymentMethod !== 'string') {
          return NextResponse.json({
            paymentMethod: {
              id: subPaymentMethod.id,
              brand: subPaymentMethod.card?.brand || 'unknown',
              last4: subPaymentMethod.card?.last4 || '****',
              expMonth: subPaymentMethod.card?.exp_month,
              expYear: subPaymentMethod.card?.exp_year,
              type: subPaymentMethod.type,
            },
          });
        }
      }

      return NextResponse.json({ paymentMethod: null });
    }

    // Return payment method details
    return NextResponse.json({
      paymentMethod: {
        id: defaultPaymentMethod.id,
        brand: defaultPaymentMethod.card?.brand || 'unknown',
        last4: defaultPaymentMethod.card?.last4 || '****',
        expMonth: defaultPaymentMethod.card?.exp_month,
        expYear: defaultPaymentMethod.card?.exp_year,
        type: defaultPaymentMethod.type,
      },
    });
  } catch (error: any) {
    console.error('Error getting payment method:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get payment method' },
      { status: 500 }
    );
  }
}
