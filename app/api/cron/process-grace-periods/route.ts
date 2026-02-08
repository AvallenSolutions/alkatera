import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import type { Database } from '@/types/db_types';

/**
 * Process Grace Periods Cron Job
 *
 * POST /api/cron/process-grace-periods
 *
 * This endpoint should be called by a cron job (e.g., daily) to:
 * 1. Send 3-day warning emails for expiring grace periods
 * 2. Process expired grace periods and auto-delete excess items
 *
 * Authentication: Requires CRON_SECRET header
 */

/** Constant-time string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      // Compare anyway to avoid timing leak on length difference
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication using constant-time comparison
    const cronSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');

    const validCronSecret = process.env.CRON_SECRET;

    // Check x-cron-secret header (timing-safe)
    const isValidCronHeader = !!(cronSecret && validCronSecret && safeCompare(cronSecret, validCronSecret));
    // Check Authorization: Bearer <CRON_SECRET> (timing-safe, exact match)
    const isValidBearerAuth = !!(authHeader && validCronSecret && safeCompare(authHeader, `Bearer ${validCronSecret}`));

    if (!isValidCronHeader && !isValidBearerAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results = {
      warningsSent: 0,
      gracePeriodExpired: 0,
      itemsDeleted: 0,
      errors: [] as string[],
    };

    // Step 1: Send 3-day warning emails
    const { data: warnings, error: warningsError } = await supabase.rpc(
      'get_grace_period_warnings'
    );

    if (warningsError) {
      console.error('Error getting warnings:', warningsError);
      results.errors.push(`Warning check error: ${warningsError.message}`);
    } else if (warnings && warnings.length > 0) {
      for (const warning of warnings) {
        try {
          // Send warning email
          await sendSubscriptionEmail(supabaseUrl, supabaseKey, warning.organization_id, 'grace_period_warning', {
            daysRemaining: warning.days_remaining,
            resourceType: warning.resource_type,
          });

          // Mark warning as sent
          await supabase.rpc('mark_grace_period_warning_sent', {
            p_organization_id: warning.organization_id,
          });

          results.warningsSent++;
        } catch (error: any) {
          console.error(`Error sending warning to org ${warning.organization_id}:`, error);
          results.errors.push(`Warning error for ${warning.organization_id}: ${error.message}`);
        }
      }
    }

    // Step 2: Process expired grace periods
    const { data: expired, error: expiredError } = await supabase.rpc(
      'process_expired_grace_periods'
    );

    if (expiredError) {
      console.error('Error processing expired grace periods:', expiredError);
      results.errors.push(`Expiration processing error: ${expiredError.message}`);
    } else if (expired && expired.length > 0) {
      for (const expiredOrg of expired) {
        results.gracePeriodExpired++;
        results.itemsDeleted += expiredOrg.items_deleted || 0;

        // Send expiry notification email
        try {
          await sendSubscriptionEmail(supabaseUrl, supabaseKey, expiredOrg.organization_id, 'grace_period_expired', {
            resourceType: expiredOrg.resource_type,
            itemsDeleted: expiredOrg.items_deleted,
          });
        } catch (error: any) {
          console.error(`Error sending expiry notification:`, error);
          results.errors.push(`Expiry email error for ${expiredOrg.organization_id}: ${error.message}`);
        }
      }
    }
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}

async function sendSubscriptionEmail(
  supabaseUrl: string,
  supabaseKey: string,
  organizationId: string,
  eventType: string,
  metadata: Record<string, any>
): Promise<void> {
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
    throw new Error(`Email send failed: ${error}`);
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to trigger grace period processing',
    endpoints: {
      'POST /api/cron/process-grace-periods': 'Process expired grace periods and send warnings',
    },
  });
}
