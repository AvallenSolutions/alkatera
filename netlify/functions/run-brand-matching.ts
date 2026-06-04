import { schedule } from '@netlify/functions';

/**
 * Distributor portal — daily alka**tera** brand-matching tick
 * (Netlify Scheduled Function).
 *
 * Runs every day at 03:00 UTC. Dispatches an Inngest event
 * `matching/sweep.run` which the `matchingSweepRun` function consumes
 * (walks unlinked brand_profiles + re-syncs already-linked ones).
 *
 * Previously this hit the synchronous /api/cron/run-brand-matching
 * route which was 300s-ceiling-bound. Now actual processing happens
 * on Inngest with step-level retries and no timeout pressure.
 *
 * Required env vars: INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
 *
 * The /api/cron/run-brand-matching + /api/admin/run-brand-matching
 * routes still exist as manual-trigger fallbacks.
 */
export const handler = schedule('0 3 * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'matching/sweep.run', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-brand-matching] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
