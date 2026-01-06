import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe/webhooks
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed: Activate subscription when payment succeeds
 * - customer.subscription.updated: Update tier when subscription changes
 * - customer.subscription.deleted: Downgrade to free when subscription cancels
 * - invoice.payment_failed: Notify when payment fails
 *
 * IMPORTANT: This route must be excluded from middleware authentication
 */

// Disable body parsing, need raw body for signature verification
export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
}

// Create Supabase admin client for webhook operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Processing Stripe event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle checkout.session.completed
 * Activate subscription when initial payment succeeds
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);

  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    console.error('No organizationId in checkout session metadata');
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Get subscription details to get the price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) {
    console.error('No price ID found in subscription');
    return;
  }

  // Update organization using the database function
  const { error } = await supabaseAdmin.rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_price_id: priceId,
    p_status: subscription.status,
  });

  if (error) {
    console.error('Error updating organization after checkout:', error);
  } else {
    console.log(`Organization ${organizationId} subscription activated`);
  }
}

/**
 * Handle customer.subscription.updated
 * Update tier when subscription changes (upgrade/downgrade)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);

  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    // Try to find organization by customer ID
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (!org) {
      console.error('No organization found for subscription:', subscription.id);
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error('No price ID found in subscription');
    return;
  }

  // Update organization using the database function
  const { error } = await supabaseAdmin.rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId || null,
    p_stripe_customer_id: subscription.customer as string,
    p_stripe_subscription_id: subscription.id,
    p_price_id: priceId,
    p_status: subscription.status,
  });

  if (error) {
    console.error('Error updating organization subscription:', error);
  } else {
    console.log(`Organization ${organizationId} subscription updated`);
  }
}

/**
 * Handle customer.subscription.deleted
 * Downgrade to free tier when subscription is cancelled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);

  // Find organization by subscription ID
  const { data: org, error: findError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (findError || !org) {
    console.error('No organization found for cancelled subscription:', subscription.id);
    return;
  }

  // Downgrade to seed (free) tier
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_tier: 'seed',
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error downgrading organization:', error);
  } else {
    console.log(`Organization ${org.id} downgraded to seed tier`);
    // TODO: Send email notification about cancellation
  }
}

/**
 * Handle invoice.payment_failed
 * Suspend subscription when payment fails
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id);

  // Extract subscription ID from invoice
  // In Stripe API, subscription can be a string ID or an expanded object
  const invoiceData = invoice as any;
  const subscriptionId = typeof invoiceData.subscription === 'string'
    ? invoiceData.subscription
    : invoiceData.subscription?.id;
  if (!subscriptionId) {
    return;
  }

  // Find organization by subscription ID
  const { data: org, error: findError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, billing_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    console.error('No organization found for failed invoice:', invoice.id);
    return;
  }

  // Update subscription status to suspended
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error suspending organization:', error);
  } else {
    console.log(`Organization ${org.id} suspended due to payment failure`);
    // TODO: Send email notification about payment failure
    // You can implement email sending here using your preferred service
    // Example: sendPaymentFailedEmail(org.billing_email, org.name, invoice.amount_due);
  }
}

/**
 * Handle invoice.payment_succeeded
 * Reactivate subscription when payment succeeds after failure
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Invoice payment succeeded:', invoice.id);

  // Extract subscription ID from invoice
  // In Stripe API, subscription can be a string ID or an expanded object
  const invoiceData = invoice as any;
  const subscriptionId = typeof invoiceData.subscription === 'string'
    ? invoiceData.subscription
    : invoiceData.subscription?.id;
  if (!subscriptionId) {
    return;
  }

  // Find organization by subscription ID
  const { data: org, error: findError } = await supabaseAdmin
    .from('organizations')
    .select('id, subscription_status')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    return;
  }

  // If organization was suspended, reactivate it
  if (org.subscription_status === 'suspended') {
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      console.error('Error reactivating organization:', error);
    } else {
      console.log(`Organization ${org.id} reactivated after successful payment`);
      // TODO: Send email notification about reactivation
    }
  }
}
