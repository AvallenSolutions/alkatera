import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron: Expire Grace Periods
 *
 * POST /api/cron/expire-grace-periods
 *
 * Finds organizations whose 7-day grace period has expired
 * and moves them from 'past_due' to 'suspended'.
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

    // Find organizations with expired grace periods
    const { data: expiredOrgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, name, billing_email, subscription_tier')
      .eq('subscription_status', 'past_due')
      .lt('grace_period_end', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired grace periods:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredOrgs || expiredOrgs.length === 0) {
      return NextResponse.json({ message: 'No expired grace periods', processed: 0 });
    }

    console.log(`Found ${expiredOrgs.length} organizations with expired grace periods`);

    let processed = 0;

    for (const org of expiredOrgs) {
      // Suspend the organization
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          subscription_status: 'suspended',
          grace_period_end: null,
          grace_period_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);

      if (updateError) {
        console.error(`Error suspending org ${org.id}:`, updateError);
        continue;
      }

      console.log(`Suspended organization ${org.id} (${org.name}) - grace period expired`);

      // Send suspension email
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            organizationId: org.id,
            eventType: 'subscription_suspended',
            metadata: {},
          }),
        });

        if (!emailResponse.ok) {
          console.error(`Failed to send suspension email for org ${org.id}`);
        }
      } catch (emailError) {
        console.error(`Error sending suspension email for org ${org.id}:`, emailError);
      }

      processed++;
    }

    return NextResponse.json({
      message: `Processed ${processed} expired grace periods`,
      processed,
    });
  } catch (error: any) {
    console.error('Error in expire-grace-periods cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
