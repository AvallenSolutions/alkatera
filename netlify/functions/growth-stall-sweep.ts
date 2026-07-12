import { schedule } from '@netlify/functions';

/**
 * Growth score stall sweep — weekly heartbeat (Netlify Scheduled Function).
 *
 * Runs every Monday at 08:00 UTC and dispatches `growth/stall.check`, which the
 * `growthStallSweep` Inngest function (lib/inngest/functions/growth.ts) consumes.
 * That function snapshots every active org's growth score and nudges orgs whose
 * score hasn't moved in 14+ days and still have setup left to do.
 *
 * Required env vars: INNGEST_EVENT_KEY (+ INNGEST_SIGNING_KEY for the webhook).
 */
export const handler = schedule('0 8 * * 1', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'growth/stall.check', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[growth-stall-sweep] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
