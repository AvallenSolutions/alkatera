import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { purgeStaleGreenwashScans, purgeStaleInvitations } from '@/lib/retention/purge';

/**
 * Daily retention purge sweep (security review 2026-05-29, HIGH-3 + MED-8).
 * Replaces two Netlify Schedules that ran back-to-back at 04:00 / 04:30 UTC
 * purely to avoid overlapping serverless invocations — both purges are
 * independent deletes, so on Inngest they run together as one function.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const retentionPurgeSweep = inngest.createFunction(
  {
    id: 'retention-purge-sweep',
    name: 'Retention: purge stale Greenwash scans + invitations',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'retention/purge.sweep' }, { cron: '0 4 * * *' }],
  },
  async ({ step }) => {
    const supabase = service();
    const greenwash = await step.run('purge-greenwash-scans', () => purgeStaleGreenwashScans(supabase));
    const invitations = await step.run('purge-invitations', () => purgeStaleInvitations(supabase));
    return { greenwash, invitations };
  },
);
