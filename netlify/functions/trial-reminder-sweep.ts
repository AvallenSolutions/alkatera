import { schedule } from '@netlify/functions';

/**
 * Free-trial reminder sweep — daily heartbeat (Netlify Scheduled Function).
 *
 * Runs every day at 09:00 UTC and dispatches `subscriptions/trial-reminder.sweep`,
 * which the `trialReminderSweep` Inngest function consumes. That function emails trial
 * orgs as they approach their charge date (7 / 3 / 1 days out) so the first charge on a
 * card-required trial is never a surprise.
 *
 * Required env vars: INNGEST_EVENT_KEY (+ INNGEST_SIGNING_KEY for the webhook). The
 * reminder emails also need RESEND_API_KEY (the edge function no-ops without it).
 */
export const handler = schedule('0 9 * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'subscriptions/trial-reminder.sweep', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[trial-reminder-sweep] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
