import { schedule } from '@netlify/functions';

/**
 * Pulse — hourly anomaly detector (Netlify Scheduled Function)
 *
 * Runs at minute 15 of every hour (deliberately offset from snapshot and
 * grid-carbon crons to avoid simultaneous load). Hits /api/cron/detect-
 * anomalies, which z-scores the latest metric_snapshots vs the trailing
 * 30-day baseline and writes flagged rows to dashboard_anomalies. High-
 * severity anomalies trigger Resend emails to org admins.
 *
 * Required env vars:
 *   - URL                (auto-provided by Netlify)
 *   - CRON_SECRET
 *   - RESEND_API_KEY     (optional; missing key just disables email alerts)
 */
export const handler = schedule('15 * * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl || !cronSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'URL or CRON_SECRET missing' }),
    };
  }

  const target = `${baseUrl}/api/cron/detect-anomalies`;
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Pulse anomalies cron failed:', res.status, body);
    } else {
      console.log('Pulse anomalies cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: any) {
    console.error('Pulse anomalies cron threw:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? 'Unknown error' }),
    };
  }
});
