import { NextRequest, NextResponse } from 'next/server';
import { stripe, getBillingIntervalFromPriceId, getTierFromPriceId } from '@/lib/stripe-config';
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

// Idempotency is durable, in the stripe_webhook_events table (migration
// 20262703900000): a per-lambda in-memory map provided no protection across
// instances, and the old flow marked events processed BEFORE handling while
// returning 200 on failure — so a transient handler failure permanently lost
// the event (Stripe never retried, and a manual retry was skipped as a
// "duplicate"). Now: claim row → handle → mark processed; failures return 500
// so Stripe retries, and only events that completed are skipped as duplicates.

/**
 * Record the event before processing. Returns 'duplicate' when a previous
 * delivery fully processed it, 'proceed' otherwise (first delivery, or a
 * retry of a failed/incomplete one — handlers are idempotent RPCs).
 */
async function claimEvent(event: Stripe.Event): Promise<'proceed' | 'duplicate'> {
  const supabase = getSupabaseAdmin();
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type });

  if (!insertError) return 'proceed';

  if (insertError.code === '23505') {
    // Already seen: skip only if that delivery completed.
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('processed')
      .eq('id', event.id)
      .maybeSingle();
    return existing?.processed ? 'duplicate' : 'proceed';
  }

  // Table unreachable (e.g. migration not yet applied): log and proceed.
  // Processing an event twice is recoverable (idempotent RPCs); dropping a
  // checkout completion is not.
  console.error('stripe_webhook_events claim failed:', insertError.message);
  return 'proceed';
}

async function markEventProcessed(eventId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString(), error: null })
    .eq('id', eventId);
  if (error) console.error('stripe_webhook_events mark-processed failed:', error.message);
}

async function markEventFailed(eventId: string, message: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({ error: message.slice(0, 1000) })
    .eq('id', eventId);
  if (error) console.error('stripe_webhook_events mark-failed failed:', error.message);
}

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
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      const webhookSecret = getWebhookSecret();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Idempotency check: skip events a previous delivery fully processed
    if ((await claimEvent(event)) === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle the event. Failures return 500 so Stripe retries: the
    // subscription RPCs are idempotent, and losing a checkout completion or
    // cancellation to a transient error is far worse than a bounded retry
    // (Stripe stops after ~3 days of exponential backoff).
    try {
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
      }
    } catch (handlerError: any) {
      console.error(`Webhook handler error for ${event.type}:`, handlerError.message);
      await markEventFailed(event.id, handlerError.message ?? 'unknown');
      return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }

    await markEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error.message);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
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
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) {
    console.error('ERROR: No organizationId in checkout session metadata');
    console.error('Available metadata keys:', Object.keys(session.metadata || {}));
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  // Get subscription details to get the price
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error('ERROR: No price ID found in subscription');
    return;
  }

  // Update organization using the database function (including current_period_end)
  // In Stripe API v2025+, current_period_end is on subscription items, not the subscription
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = itemPeriodEnd
    ? new Date(itemPeriodEnd * 1000).toISOString()
    : null;

  const billingInterval = getBillingIntervalFromPriceId(priceId);
  const { error } = await getSupabaseAdmin().rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_price_id: priceId,
    p_status: subscription.status,
    p_current_period_end: currentPeriodEnd,
    p_billing_interval: billingInterval,
  });

  if (error) {
    console.error('ERROR updating organization after checkout:');
    console.error('  Message:', error.message);
    console.error('  Details:', error.details);
    console.error('  Hint:', error.hint);
    console.error('  Full error:', JSON.stringify(error, null, 2));
  }

  // Free trial: mirror Stripe's authoritative trial_end into subscription_expires_at
  // so the in-app countdown banner and the expiring_trials admin aggregate have a
  // source of truth. (update_subscription_from_stripe already maps 'trialing' -> 'trial'.)
  if (subscription.status === 'trialing' && subscription.trial_end) {
    const { error: trialError } = await getSupabaseAdmin()
      .from('organizations')
      .update({ subscription_expires_at: new Date(subscription.trial_end * 1000).toISOString() })
      .eq('id', organizationId);
    if (trialError) {
      console.error('Error mirroring trial_end to subscription_expires_at:', trialError.message);
    }
  }

  // Import billing details from checkout session
  try {
    const billingUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (session.customer_details?.email) {
      billingUpdate.billing_email = session.customer_details.email;
    }
    if (session.customer_details?.name) {
      billingUpdate.billing_name = session.customer_details.name;
    }
    if (session.customer_details?.address) {
      const addr = session.customer_details.address;
      if (addr.line1) billingUpdate.billing_address_line1 = addr.line1;
      if (addr.city) billingUpdate.billing_address_city = addr.city;
      if (addr.country) billingUpdate.billing_address_country = addr.country;
      if (addr.postal_code) billingUpdate.billing_address_postal_code = addr.postal_code;
    }
    if (session.customer_details?.tax_ids && session.customer_details.tax_ids.length > 0) {
      billingUpdate.tax_id = session.customer_details.tax_ids[0].value;
    }

    if (Object.keys(billingUpdate).length > 1) {
      await getSupabaseAdmin()
        .from('organizations')
        .update(billingUpdate)
        .eq('id', organizationId);
    }
  } catch (billingError) {
    console.error('Error importing billing details from checkout:', billingError);
  }

  // Card-on-file trial that does NOT auto-convert. We keep the card (anti-fraud + one-click
  // conversion later) but set the subscription to cancel at the trial end so Stripe never
  // charges automatically. At trial end Stripe fires customer.subscription.deleted, which
  // flips the org to read-only and emails "trial ended, choose a plan". The saved card stays
  // on the Stripe customer, so subscribing later is a single click.
  if (subscription.status === 'trialing') {
    try {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    } catch (cancelErr: any) {
      console.error('Error setting trial to cancel at period end:', cancelErr?.message);
    }
    // Welcome email — sets expectations: 30 days free, no automatic charge, choose a plan to continue.
    await sendSubscriptionEmail(organizationId, 'trial_started', {
      tier: getTierFromPriceId(priceId),
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    });
  }
}

/**
 * Handle customer.subscription.updated
 * Update tier when subscription changes (upgrade/downgrade)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
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

  // Update organization using the database function (including current_period_end)
  // In Stripe API v2025+, current_period_end is on subscription items, not the subscription
  const subItemPeriodEnd = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = subItemPeriodEnd
    ? new Date(subItemPeriodEnd * 1000).toISOString()
    : null;

  const subBillingInterval = getBillingIntervalFromPriceId(priceId);
  const { error } = await getSupabaseAdmin().rpc('update_subscription_from_stripe', {
    p_organization_id: organizationId,
    p_stripe_customer_id: subscription.customer as string,
    p_stripe_subscription_id: subscription.id,
    p_price_id: priceId,
    p_status: subscription.status,
    p_current_period_end: currentPeriodEnd,
    p_billing_interval: subBillingInterval,
  });

  if (error) {
    console.error('Error updating organization subscription:', error);
    return;
  }
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
      stripe_price_id: null,
      grace_period_end: null,
      grace_period_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  if (error) {
    console.error('Error downgrading organization:', error);
  } else {
    // Log the cancellation
    await getSupabaseAdmin().rpc('log_subscription_change', {
      p_organization_id: org.id,
      p_event_type: 'cancellation',
      p_previous_tier: previousTier,
      p_new_tier: 'seed',
      p_previous_status: previousStatus,
      p_new_status: 'cancelled',
    });

    // A trial that ends without converting reaches here too (the trial sub is set to
    // cancel at period end). Distinguish it from a paying customer churning so we send the
    // right message: "trial ended, choose a plan" vs the generic cancellation note.
    if (previousStatus === 'trial') {
      await sendSubscriptionEmail(org.id, 'trial_ended', {
        trialEndsAt: new Date().toISOString(),
      });
    } else if (previousStatus !== 'cancelled') {
      await sendSubscriptionEmail(org.id, 'subscription_cancelled', {
        previousTier,
      });
    }
    // If already 'cancelled', the daily sweep's expiry backstop handled this first —
    // don't send a duplicate email.
  }
}

/**
 * Handle invoice.payment_failed
 * Suspend subscription when payment fails
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
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

  // Fetch the latest subscription to get updated current_period_end
  let periodEndUpdate: Record<string, any> = {};
  try {
    const freshSubscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
    const freshPeriodEnd = freshSubscription.items.data[0]?.current_period_end;
    if (freshPeriodEnd) {
      periodEndUpdate.current_period_end = new Date(freshPeriodEnd * 1000).toISOString();
    }
  } catch (subError) {
    console.error('Error fetching subscription for period end update:', subError);
  }

  // If organization was suspended or past_due, reactivate it
  if (wasInactive) {
    const { error } = await getSupabaseAdmin()
      .from('organizations')
      .update({
        subscription_status: 'active',
        grace_period_end: null,
        grace_period_started_at: null,
        updated_at: new Date().toISOString(),
        ...periodEndUpdate,
      })
      .eq('id', org.id);

    if (error) {
      console.error('Error reactivating organization:', error);
    } else {
      // Send email notification about reactivation
      await sendSubscriptionEmail(org.id, 'subscription_reactivated', {
        amount: invoice.amount_paid,
        wasReactivated: true,
      });
    }
  } else {
    // Update current_period_end and send payment receipt email
    if (Object.keys(periodEndUpdate).length > 0) {
      await getSupabaseAdmin()
        .from('organizations')
        .update({
          updated_at: new Date().toISOString(),
          ...periodEndUpdate,
        })
        .eq('id', org.id);
    }

    await sendSubscriptionEmail(org.id, 'payment_succeeded', {
      amount: invoice.amount_paid,
      wasReactivated: false,
    });
  }
}
