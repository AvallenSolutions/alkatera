import { schedule } from '@netlify/functions';

/**
 * Distributor portal — scraping queue processor (Netlify Scheduled Function)
 *
 * Runs every 5 minutes. POSTs to the protected Next.js cron route
 * /api/cron/process-scraping-queue, which dequeues up to 3 queued
 * scraping_jobs and runs the brand-agent against each.
 *
 * Required env vars (set in Netlify → Site settings → Environment variables):
 *   - URL          (provided automatically by Netlify; canonical site URL)
 *   - CRON_SECRET  (must match the value the API route checks for)
 *
 * Cron expression "*\/5 * * * *" = every 5 minutes. UTC.
 */
export const handler = schedule('*/5 * * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'URL env var missing' }) };
  }
  if (!cronSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET env var missing' }) };
  }

  const target = `${baseUrl}/api/cron/process-scraping-queue`;

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
      console.error('Scraping queue cron failed:', res.status, body);
    } else {
      console.log('Scraping queue cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Scraping queue cron threw:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
});
