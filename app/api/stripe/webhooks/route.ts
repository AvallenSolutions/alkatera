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
// Helper Functions
// ============================================================================

/**
 * Send subscription-related email notification
 */
async function sendSubscriptionEmail(
  organizationId: string,
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('Skipping email - missing Supabase config');
      return;
    }

    // Call the edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        organizationId,
        eventType,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error sending subscription email:', error);
    } else {
      console.log(`Subscription email sent: ${eventType} for org ${organizationId}`);
    }
  } catch (error) {
    console.error('Failed to send subscription email:', error);
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

  let organizationId = subscription.metadata?.organizationId;

  // Try to find organization by customer ID if not in metadata
  if (!organizationId) {
    const { data: org } = await getSupabaseAdmin()
      .from('organizations')
      .select('id, subscription_tier')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (!org) {
      console.error('No organization found for subscription:', subscription.id);
      return;
    }
    organizationId = org.id;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error('No price ID found in subscription');
    return;
  }

  // Get the current tier before updating
  const { data: currentOrg } = await getSupabaseAdmin()
    .from('organizations')
    .select('subscription_tier, subscription_status')
    .eq('id', organizationId)
    .single();

  const previousTier = currentOrg?.subscription_tier;
  const previousStatus = currentOrg?.subscription_status;

  // Update organization using the database function
  const { error } = await getSupabaseAdmin().rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId,
    p_stripe_customer_id: subscription.customer as string,
    p_stripe_subscription_id: subscription.id,
    p_price_id: priceId,
    p_status: subscription.status,
  });

  if (error) {
    console.error('Error updating organization subscription:', error);
    return;
  }

  console.log(`Organization ${organizationId} subscription updated`);

  // Get the new tier after update
  const { data: updatedOrg } = await getSupabaseAdmin()
    .from('organizations')
    .select('subscription_tier')
    .eq('id', organizationId)
    .single();

  const newTier = updatedOrg?.subscription_tier;

  // Log the subscription change if tier changed
  if (previousTier && newTier && previousTier !== newTier) {
    const tierLevels: Record<string, number> = { seed: 1, blossom: 2, canopy: 3 };
    const isUpgrade = tierLevels[newTier] > tierLevels[previousTier];
    const eventType = isUpgrade ? 'upgrade' : 'downgrade';

    // Log the change
    await getSupabaseAdmin().rpc('log_subscription_change', {
      p_organization_id: organizationId,
      p_event_type: eventType,
      p_previous_tier: previousTier,
      p_new_tier: newTier,
      p_previous_status: previousStatus,
      p_new_status: subscription.status,
    });

    // Check if downgrade exceeds limits and start grace period
    if (!isUpgrade) {
      const { data: limitCheck } = await getSupabaseAdmin().rpc('check_downgrade_limits', {
        p_organization_id: organizationId,
        p_new_tier: newTier,
      });

      const overLimitResources = limitCheck?.filter((l: any) => l.over_limit) || [];

      if (overLimitResources.length > 0) {
        // Start grace period for the first over-limit resource
        const primaryResource = overLimitResources[0];
        await getSupabaseAdmin().rpc('start_grace_period', {
          p_organization_id: organizationId,
          p_resource_type: primaryResource.resource_type,
          p_previous_tier: previousTier,
        });

        // Send grace period email
        await sendSubscriptionEmail(organizationId, 'grace_period_started', {
          currentUsage: primaryResource.current_usage,
          newLimit: primaryResource.new_limit,
          excessCount: primaryResource.excess_count,
        });
      }
    }

    // Send email notification
    await sendSubscriptionEmail(organizationId, isUpgrade ? 'plan_upgraded' : 'plan_downgraded', {
      previousTier,
      newTier,
      gracePeriod: !isUpgrade,
    });
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
    .select('id, subscription_tier, subscription_status')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (findError || !org) {
    console.error('No organization found for cancelled subscription:', subscription.id);
    return;
  }

  const previousTier = org.subscription_tier;
  const previousStatus = org.subscription_status;

  // Downgrade to seed (free) tier, clear grace period, keep all data
  const { error } = await getSupabaseAdmin()
    .from('organizations')
    .update({
      subscription_tier: 'seed',
      subscription_status: 'cancelled',
      stripe_subscription_id: null,
      grace_period_end: null,
      grace_period_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error downgrading organization:', error);
  } else {
    console.log(`Organization ${org.id} downgraded to seed tier`);

    // Log the cancellation
    await getSupabaseAdmin().rpc('log_subscription_change', {
      p_organization_id: org.id,
      p_event_type: 'cancellation',
      p_previous_tier: previousTier,
      p_new_tier: 'seed',
      p_previous_status: previousStatus,
      p_new_status: 'cancelled',
    });

    // Send email notification about cancellation
    await sendSubscriptionEmail(org.id, 'subscription_cancelled', {
      previousTier,
    });
  }
}

/**
 * Handle invoice.payment_failed
 * Suspend subscription when payment fails
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id);

  // Extract subscription ID from invoice
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
    .select('id, name, billing_email, subscription_tier, subscription_status, grace_period_end')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    console.error('No organization found for failed invoice:', invoice.id);
    return;
  }

  const previousStatus = org.subscription_status;

  // If already past_due (retry), don't reset the grace period
  if (org.subscription_status === 'past_due' || org.subscription_status === 'suspended') {
    console.log(`Organization ${org.id} already ${org.subscription_status}, skipping duplicate payment_failed`);
    return;
  }

  // Start 7-day grace period — set to past_due, not suspended
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

  const { error } = await getSupabaseAdmin()
    .from('organizations')
    .update({
      subscription_status: 'past_due',
      grace_period_started_at: new Date().toISOString(),
      grace_period_end: gracePeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error setting organization to past_due:', error);
  } else {
    console.log(`Organization ${org.id} set to past_due with grace period ending ${gracePeriodEnd.toISOString()}`);

    // Send email notification about payment failure
    await sendSubscriptionEmail(org.id, 'payment_failed', {
      amount: invoice.amount_due,
      gracePeriodEnd: gracePeriodEnd.toISOString(),
    });
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
    .select('id, subscription_status, subscription_tier')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (findError || !org) {
    return;
  }

  const wasInactive = org.subscription_status === 'suspended' || org.subscription_status === 'past_due';

  // If organization was suspended or past_due, reactivate it
  if (wasInactive) {
    const { error } = await getSupabaseAdmin()
      .from('organizations')
      .update({
        subscription_status: 'active',
        grace_period_end: null,
        grace_period_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      console.error('Error reactivating organization:', error);
    } else {
      console.log(`Organization ${org.id} reactivated after successful payment (was ${org.subscription_status})`);

      // Send email notification about reactivation
      await sendSubscriptionEmail(org.id, 'subscription_reactivated', {
        amount: invoice.amount_paid,
        wasReactivated: true,
      });
    }
  } else {
    // Send payment receipt email for active orgs
    await sendSubscriptionEmail(org.id, 'payment_succeeded', {
      amount: invoice.amount_paid,
      wasReactivated: false,
    });
  }
}
