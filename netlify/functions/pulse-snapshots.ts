import { schedule } from '@netlify/functions';

/**
 * Pulse — daily snapshot generator (Netlify Scheduled Function)
 *
 * Runs every day at 02:00 UTC. Hits the protected Next.js cron route
 * /api/cron/generate-snapshots, which iterates every organisation and
 * writes today's row to metric_snapshots. That table powers the
 * sparklines and period-over-period deltas on /pulse.
 *
 * Required env vars (set in Netlify → Site settings → Environment variables):
 *   - URL          (provided automatically by Netlify; canonical site URL)
 *   - CRON_SECRET  (must match the value the API route checks for)
 *
 * The cron expression "0 2 * * *" = at minute 0 of hour 2, every day.
 * Times are UTC for Netlify Scheduled Functions.
 */
export const handler = schedule('0 2 * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'URL env var missing' }),
    };
  }
  if (!cronSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CRON_SECRET env var missing' }),
    };
  }

  const target = `${baseUrl}/api/cron/generate-snapshots`;

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
      console.error('Pulse snapshot cron failed:', res.status, body);
    } else {
      console.log('Pulse snapshot cron success:', body);
    }

    return {
      statusCode: res.status,
      body: JSON.stringify(body),
    };
  } catch (err: any) {
    console.error('Pulse snapshot cron threw:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? 'Unknown error' }),
    };
  }
});
