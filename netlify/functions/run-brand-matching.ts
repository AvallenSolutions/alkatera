import { schedule } from '@netlify/functions';

/**
 * Distributor portal — daily alkatera brand-matching sweep
 * (Netlify Scheduled Function).
 *
 * Runs every day at 03:00 UTC, just after the pulse snapshot cron at
 * 02:00 UTC so it doesn't fight for compute budget. Hits
 * /api/cron/run-brand-matching, which walks unlinked brand_profiles +
 * re-syncs tiers for already-linked ones.
 *
 * Required env vars: URL (auto), CRON_SECRET.
 */
export const handler = schedule('0 3 * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'URL env var missing' }) };
  }
  if (!cronSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET env var missing' }) };
  }

  const target = `${baseUrl}/api/cron/run-brand-matching`;
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
      console.error('Brand matching cron failed:', res.status, body);
    } else {
      console.log('Brand matching cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Brand matching cron threw:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
});
