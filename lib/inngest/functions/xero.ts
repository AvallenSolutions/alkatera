import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { inngest } from '../client';
import { syncOrganisation } from '@/lib/xero/sync-service';
import { findSupplierMatches } from '@/lib/xero/supplier-matcher';
import {
  studioLayout,
  studioNotice,
  studioFactTable,
  escapeEmailHtml,
} from '@/lib/email/studio-layout';

/**
 * Xero scheduled sync, on Inngest. Replaces the synchronous loop in
 * `/api/cron/xero-sync` that synced every connected org sequentially in one
 * Netlify invocation — the banned 300s-ceiling pattern: a mid-loop kill
 * silently skipped every later org (no failure email, because the email code
 * never ran) and stranded the in-flight org's xero_sync_logs at 'started'.
 *
 * Flow:
 *
 *   /api/cron/xero-sync (heartbeat) → inngest.send('xero/sync.tick')
 *                              │
 *                              ▼
 *                      xeroSyncTick
 *                      - Fans out one 'xero/org.sync' per connection
 *                              │
 *                              ▼
 *                      xeroOrgSync (per org)
 *                      - Runs the full syncOrganisation
 *                      - onFailure sends the admin alert email
 *
 * Each org sync is its own Inngest run with its own retry envelope, so one
 * slow or broken connection can no longer starve the rest.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const xeroSyncTick = inngest.createFunction(
  {
    id: 'xero-sync-tick',
    name: 'Xero sync: fan out connected orgs',
    concurrency: { limit: 1 },
    retries: 0,
    triggers: [{ event: 'xero/sync.tick' }, { cron: '0 * * * *' }],
  },
  async ({ step }) => {
    const supabase = service();

    const orgIds = await step.run('list-connections', async () => {
      const { data, error } = await supabase
        .from('xero_connections')
        .select('organization_id');
      if (error) throw new Error(`Failed to list Xero connections: ${error.message}`);
      return Array.from(new Set((data ?? []).map((c: { organization_id: string }) => c.organization_id)));
    });

    if (orgIds.length === 0) {
      return { dispatched: 0 };
    }

    await step.sendEvent(
      'fan-out-org-syncs',
      orgIds.map((organizationId) => ({
        name: 'xero/org.sync' as const,
        data: { organization_id: organizationId },
      })),
    );

    return { dispatched: orgIds.length };
  },
);

export const xeroOrgSync = inngest.createFunction(
  {
    id: 'xero-org-sync',
    name: 'Xero sync: one organisation',
    // Serialise per org (a second tick must not overlap a long first sync)
    // and keep global fan-out modest to respect Xero rate limits.
    concurrency: [
      { key: 'event.data.organization_id', limit: 1 },
      { limit: 3 },
    ],
    retries: 1,
    triggers: [{ event: 'xero/org.sync' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { organization_id: string };
      const organizationId = original?.organization_id ?? 'unknown';
      console.error(`Xero sync failed for organisation ${organizationId}:`, error);

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured, skipping Xero sync failure alert');
        return;
      }
      const resend = new Resend(resendApiKey);
      const alertEmail = process.env.ADMIN_EMAIL || 'hello@alkatera.com';
      try {
        await resend.emails.send({
          from: 'alkatera Sync <alerts@mail.alkatera.com>',
          to: [alertEmail],
          subject: `Xero Sync: organisation ${organizationId} failed`,
          html: studioLayout({
            eyebrow: 'Xero sync',
            content: [
              studioNotice(
                'danger',
                'Sync failed',
                'Scheduled sync failed after retries.',
              ),
              studioFactTable([
                ['Organisation', escapeEmailHtml(organizationId)],
                ['Error', escapeEmailHtml(error.message)],
                ['Time', new Date().toISOString()],
              ]),
            ].join(''),
            footerNote: 'Sent by the alka<strong>tera</strong> scheduled sync.',
          }),
        });
      } catch (emailError) {
        console.error('Failed to send Xero sync alert email:', emailError);
      }
    },
  },
  async ({ event, step }) => {
    const { organization_id } = event.data as { organization_id: string };

    // syncOrganisation manages its own xero_sync_logs lifecycle (including
    // writing 'error' status on failure); a throw here propagates so Inngest
    // retries, and onFailure alerts when attempts exhaust.
    const result = await step.run('sync-organisation', async () => {
      return syncOrganisation(organization_id, 'cron');
    });

    // Reconcile Xero contacts to supplier records so spend (and its
    // spend-based emissions) can be rolled up per supplier. Best-effort:
    // a matching hiccup must not fail or retry the whole sync.
    const matching = await step.run('match-suppliers', async () => {
      try {
        return await findSupplierMatches(service(), organization_id);
      } catch (err) {
        console.error('[xero] supplier matching failed (non-fatal):', err);
        return { matched: 0, unmatched: 0, error: true };
      }
    });

    return { organization_id, result, matching };
  },
);
