import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe-config';

/**
 * Cron: Annual Renewal Reminders
 *
 * POST /api/cron/renewal-reminders
 *
 * Finds organizations with annual subscriptions renewing within 7 days
 * and sends them a reminder email with the renewal amount.
 *
 * Protected by CRON_SECRET header.
 * Should be called daily by an external cron service.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find active organizations with Stripe subscriptions
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, name, billing_email, subscription_tier, stripe_subscription_id')
      .eq('subscription_status', 'active')
      .not('stripe_subscription_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching organizations:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions found', reminded: 0 });
    }

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysFromNow = now + (7 * 24 * 60 * 60);
    let reminded = 0;

    for (const org of orgs) {
      try {
        // Get subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id!) as any;

        // Only process annual subscriptions
        const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;
        if (priceInterval !== 'year') {
          continue;
        }

        // Check if renewal is within 7 days
        const periodEnd = subscription.current_period_end;
        if (periodEnd > now && periodEnd <= sevenDaysFromNow) {
          const renewalDate = new Date(periodEnd * 1000);
          const amount = subscription.items.data[0]?.price?.unit_amount || 0;
          // Send reminder email
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              organizationId: org.id,
              eventType: 'annual_renewal_reminder',
              metadata: {
                renewalDate: renewalDate.toISOString(),
                amount,
                tier: org.subscription_tier,
              },
            }),
          });

          if (!emailResponse.ok) {
            console.error(`Failed to send renewal reminder for org ${org.id}`);
          } else {
            reminded++;
          }
        }
      } catch (stripeError) {
        console.error(`Error checking subscription for org ${org.id}:`, stripeError);
      }
    }

    return NextResponse.json({
      message: `Sent ${reminded} renewal reminders`,
      reminded,
      checked: orgs.length,
    });
  } catch (error: any) {
    console.error('Error in renewal-reminders cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
