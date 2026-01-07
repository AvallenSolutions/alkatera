import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db_types';
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

// Lazy initialization to prevent build-time errors
let _webhookSecret: string | null = null;
let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getWebhookSecret(): string {
  if (!_webhookSecret) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
    }
    _webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }
  return _webhookSecret;
}

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables for webhook handler');
    }

    _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('Stripe Webhook Request Received');
  console.log('========================================');
  console.log('URL:', request.url);
  console.log('Method:', request.method);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('Body length:', body.length);
    console.log('Has signature:', !!signature);

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      const webhookSecret = getWebhookSecret();
      console.log('Using webhook secret (first 8 chars):', webhookSecret.substring(0, 8) + '...');
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Signature verification successful');
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Processing Stripe event: ${event.type} (ID: ${event.id})`);

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

    console.log('Event processed successfully');
    console.log('========================================');
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('========================================');
    console.error('Error processing webhook:', error);
    console.error('Stack:', error.stack);
    console.error('========================================');
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
  console.log('>>> Handling checkout.session.completed');
  console.log('Session ID:', session.id);
  console.log('Metadata:', session.metadata);

  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    console.error('ERROR: No organizationId in checkout session metadata');
    console.error('Available metadata keys:', Object.keys(session.metadata || {}));
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  console.log('Customer ID:', customerId);
  console.log('Subscription ID:', subscriptionId);

  // Get subscription details to get the price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  console.log('Subscription status:', subscription.status);
  console.log('Price ID:', priceId);

  if (!priceId) {
    console.error('ERROR: No price ID found in subscription');
    return;
  }

  // Update organization using the database function
  console.log('Calling update_subscription_from_stripe with params:');
  console.log('  p_organization_id:', organizationId);
  console.log('  p_stripe_customer_id:', customerId);
  console.log('  p_stripe_subscription_id:', subscriptionId);
  console.log('  p_price_id:', priceId);
  console.log('  p_status:', subscription.status);

  const { error } = await getSupabaseAdmin().rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_price_id: priceId,
    p_status: subscription.status,
  });

  if (error) {
    console.error('ERROR updating organization after checkout:');
    console.error('  Message:', error.message);
    console.error('  Details:', error.details);
    console.error('  Hint:', error.hint);
    console.error('  Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log(`SUCCESS: Organization ${organizationId} subscription activated`);
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
    const { data: org } = await getSupabaseAdmin()
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
  const { error } = await getSupabaseAdmin().rpc('update_subscription_from_stripe', {
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
  const { data: org, error: findError } = await getSupabaseAdmin()
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (findError || !org) {
    console.error('No organization found for cancelled subscription:', subscription.id);
    return;
  }

  // Downgrade to seed (free) tier
  const { error } = await getSupabaseAdmin()
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
  const { data: org, error: findError } = await getSupabaseAdmin()
    .from('organizations')
    .select('id, name, billing_email')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    console.error('No organization found for failed invoice:', invoice.id);
    return;
  }

  // Update subscription status to suspended
  const { error } = await getSupabaseAdmin()
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
  const { data: org, error: findError } = await getSupabaseAdmin()
    .from('organizations')
    .select('id, subscription_status')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    return;
  }

  // If organization was suspended, reactivate it
  if (org.subscription_status === 'suspended') {
    const { error } = await getSupabaseAdmin()
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
