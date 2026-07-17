import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { processAlkateraSyncQueue } from '@/lib/distributor/integration/alkatera-sync-queue';
import { runReminderSweep } from '@/lib/distributor/outreach/reminder-sweep';

/**
 * Distributor-portal scheduled jobs that don't belong in
 * lib/inngest/functions/distributor-jobs.ts (the event-triggered
 * background workers ported from netlify/functions/*-background.ts).
 * These two are cron-native sweeps with no per-item event payload.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Drains the alkatera_sync_queue every minute. Replaces the
 * `/api/cron/process-alkatera-sync-queue` Netlify Schedule (formerly
 * declared in netlify.toml, once a minute) — the route stays as a
 * manual/admin fallback.
 */
export const alkateraSyncQueueTick = inngest.createFunction(
  {
    id: 'alkatera-sync-queue-tick',
    name: 'alka**tera** live-data sync queue: drain',
    concurrency: { limit: 1 },
    retries: 0,
    triggers: [{ event: 'distributor/alkatera-sync-queue.tick' }, { cron: '*/1 * * * *' }],
  },
  async ({ step }) => step.run('drain-queue', () => processAlkateraSyncQueue(service())),
);

/**
 * Daily distributor outreach reminder sweep. Replaces the
 * `/api/cron/process-reminders` Netlify Schedule (netlify.toml: `0 9 * * *`).
 */
export const distributorReminderSweep = inngest.createFunction(
  {
    id: 'distributor-reminder-sweep',
    name: 'Distributor outreach: reminder sweep',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'distributor/reminder-sweep.run' }, { cron: '0 9 * * *' }],
  },
  async ({ step }) => step.run('run-reminder-sweep', () => runReminderSweep(service())),
);
