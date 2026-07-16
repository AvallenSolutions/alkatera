import { schedule } from '@netlify/functions';

/**
 * Email-in intake heartbeat (Netlify Scheduled Function).
 *
 * Runs every 10 minutes and dispatches `email/intake.poll`, which the
 * `emailIntakePoll` Inngest function (lib/inngest/functions/email-intake.ts)
 * consumes: connects to the org intake mailbox over IMAP, reads UNSEEN
 * messages, and stages any supported attachments through the Smart Upload
 * pipeline. This function is a pure heartbeat — one event send, no IMAP
 * import here — exactly the shape of netlify/functions/growth-stall-sweep.ts.
 *
 * No-ops gracefully (the Inngest function itself logs and returns) until
 * EMAIL_INTAKE_HOST/USER/PASSWORD are set, so it's safe to ship dormant.
 *
 * Required env vars: INNGEST_EVENT_KEY (+ INNGEST_SIGNING_KEY for the webhook),
 * plus EMAIL_INTAKE_HOST / EMAIL_INTAKE_USER / EMAIL_INTAKE_PASSWORD to go live.
 */
export const handler = schedule('*/10 * * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'email/intake.poll', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email-intake-poll] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
