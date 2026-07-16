import { schedule } from '@netlify/functions';

/**
 * Rosa learning curation sweep -- weekly heartbeat (Netlify Scheduled Function).
 *
 * Runs every Monday at 09:00 UTC (an hour after growth-stall-sweep, so the
 * two weekly sweeps don't contend) and dispatches `rosa/learning.sweep`,
 * which the `rosaLearningSweep` Inngest function
 * (lib/inngest/functions/rosa-learning.ts) consumes. That function gathers
 * the last 7 days of Rosa failure signals (feedback, knowledge misses,
 * cancelled proposals, rephrases, post-answer tickets), clusters them
 * deterministically, and writes rosa_learning_cases rows for the admin
 * queue at /admin/rosa-learning.
 *
 * Required env vars: INNGEST_EVENT_KEY (+ INNGEST_SIGNING_KEY for the webhook).
 */
export const handler = schedule('0 9 * * 1', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'rosa/learning.sweep', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rosa-learning-sweep] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
