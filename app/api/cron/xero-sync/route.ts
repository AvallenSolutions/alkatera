import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { syncOrganisation } from '@/lib/xero/sync-service';

/**
 * Cron: Xero Scheduled Sync
 *
 * POST /api/cron/xero-sync
 *
 * Iterates all connected Xero organisations and triggers a full sync.
 * Sends an alert email if any organisations fail to sync.
 *
 * Protected by CRON_SECRET header.
 * Should be called on a schedule by an external cron service (e.g. daily).
 */

export const runtime = 'nodejs';

interface SyncFailure {
  organizationId: string;
  error: string;
  timestamp: string;
}

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

    // Fetch all active Xero connections
    const { data: connections, error: fetchError } = await supabase
      .from('xero_connections')
      .select('organization_id');

    if (fetchError) {
      console.error('Error fetching Xero connections:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No Xero connections found', synced: 0, failed: 0, total: 0 });
    }

    let successCount = 0;
    const failures: SyncFailure[] = [];

    for (const connection of connections) {
      try {
        await syncOrganisation(connection.organization_id, 'cron');
        successCount++;
      } catch (err: any) {
        const failure: SyncFailure = {
          organizationId: connection.organization_id,
          error: err?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        failures.push(failure);
        console.error(`Xero sync failed for organisation ${connection.organization_id}:`, err);
      }
    }

    // Send alert email if there were failures
    if (failures.length > 0) {
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const alertEmail = process.env.ADMIN_ALERT_EMAIL || 'hello@alkatera.com';

        const failureRows = failures
          .map(
            (f) =>
              `<tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #333; color: #fff; font-size: 13px; font-family: monospace;">${f.organizationId}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #333; color: #ff6b6b; font-size: 13px;">${f.error}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #333; color: #888; font-size: 12px;">${f.timestamp}</td>
              </tr>`
          )
          .join('');

        try {
          await resend.emails.send({
            from: 'alkatera Sync <alerts@mail.alkatera.com>',
            to: [alertEmail],
            subject: `Xero Sync: ${failures.length} organisation(s) failed`,
            html: `
              <div style="font-family: 'Courier New', monospace; max-width: 700px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
                <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
                  <h1 style="color: #ff6b6b; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Xero Sync Alert</h1>
                </div>
                <p style="color: #ccc; font-size: 14px; margin-bottom: 20px;">
                  ${failures.length} of ${connections.length} organisation(s) failed to sync. ${successCount} synced successfully.
                </p>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                  <thead>
                    <tr>
                      <th style="padding: 8px 12px; text-align: left; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #444;">Organisation ID</th>
                      <th style="padding: 8px 12px; text-align: left; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #444;">Error</th>
                      <th style="padding: 8px 12px; text-align: left; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #444;">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${failureRows}
                  </tbody>
                </table>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
                  alkatera Scheduled Sync
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error('Failed to send Xero sync alert email:', emailError);
        }
      } else {
        console.error('RESEND_API_KEY not configured, skipping alert email for Xero sync failures');
      }
    }

    return NextResponse.json({
      synced: successCount,
      failed: failures.length,
      total: connections.length,
      failures,
    });
  } catch (error: any) {
    console.error('Error in xero-sync cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
