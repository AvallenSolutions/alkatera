import { schedule } from '@netlify/functions';

/**
 * Distributor portal — scraping queue heartbeat (Netlify Scheduled Function).
 *
 * Runs every 5 minutes and POSTs the Next route
 * /api/cron/process-scraping-queue (CRON_SECRET-authed). That route
 * claims queued jobs, marks them running, recovers stale ones, and fires
 * the scrape-brand-background function per job — all from the Next server
 * handler, which is the proven path for invoking background functions.
 *
 * This scheduled fn does NOT do the work itself: it's a tiny POST that
 * returns fast, so it never approaches the function timeout. The heavy
 * scrape runs in the 15-min background function.
 */
export const handler = schedule('*/5 * * * *', async () => {
  const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'https://alkatera.com';
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[scraping-heartbeat] CRON_SECRET not set');
    return { statusCode: 500, body: 'misconfigured' };
  }
  try {
    const res = await fetch(`${baseUrl}/api/cron/process-scraping-queue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    console.log('[scraping-heartbeat]', res.status, text.slice(0, 200));
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scraping-heartbeat] failed:', message);
    return { statusCode: 500, body: message };
  }
});
