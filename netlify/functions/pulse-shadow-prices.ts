import { schedule } from '@netlify/functions';

/**
 * Pulse -- quarterly shadow price refresh (Netlify Scheduled Function)
 *
 * Runs on the first day of each quarter at 08:00 UTC:
 *   1 Jan, 1 Apr, 1 Jul, 1 Oct
 *
 * Hits /api/cron/refresh-shadow-prices which reads the reference prices from
 * lib/pulse/reference-shadow-prices.ts and upserts them as global defaults
 * in the org_shadow_prices table.
 *
 * TO UPDATE PRICES FOR A NEW QUARTER
 * ====================================
 * 1. Edit lib/pulse/reference-shadow-prices.ts -- update price_per_unit,
 *    source and REFERENCE_QUARTER.
 * 2. Commit and deploy to Netlify.
 * 3. This function will run automatically on the next quarter boundary,
 *    OR trigger it immediately via the admin Refresh button on /pulse.
 *
 * Required env vars (Netlify → Site settings → Environment variables):
 *   - URL          (provided automatically by Netlify)
 *   - CRON_SECRET  (must match the value the API route checks for)
 *
 * Cron expression "0 8 1 1,4,7,10 *":
 *   minute 0, hour 8 UTC, day-of-month 1, months 1/4/7/10, any day-of-week
 */
export const handler = schedule('0 8 1 1,4,7,10 *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'URL env var missing' }) };
  }
  if (!cronSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET env var missing' }) };
  }

  const target = `${baseUrl}/api/cron/refresh-shadow-prices`;

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
      console.error('Pulse shadow-price refresh failed:', res.status, body);
    } else {
      console.log('Pulse shadow-price refresh success:', body);
    }

    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: any) {
    console.error('Pulse shadow-price refresh threw:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err?.message ?? 'Unknown error' }) };
  }
});
