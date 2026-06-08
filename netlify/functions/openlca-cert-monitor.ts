import { schedule } from '@netlify/functions';

/**
 * OpenLCA TLS cert expiry monitor — daily heartbeat (Netlify Scheduled Function).
 *
 * Runs every day at 08:00 UTC and dispatches `monitoring/openlca-cert.check`,
 * which the `openlcaCertMonitor` Inngest function consumes. The function reads
 * the certs on the self-hosted ecoinvent + Agribalyse gdt-servers and emails an
 * alert ~2 weeks before expiry (and daily once expired), so the silent
 * cert-expiry outage of June 2026 can't recur unnoticed.
 *
 * Required env vars: INNGEST_EVENT_KEY (+ INNGEST_SIGNING_KEY for the webhook).
 * The actual cert check + email also need RESEND_API_KEY and (optionally)
 * ADMIN_ALERT_EMAIL. On-demand equivalent: GET /api/admin/openlca/cert-check.
 */
export const handler = schedule('0 8 * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'monitoring/openlca-cert.check', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[openlca-cert-monitor] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
