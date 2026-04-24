import { schedule } from '@netlify/functions';

/**
 * Pulse — UK grid-carbon refresh (Netlify Scheduled Function)
 *
 * Runs every 30 minutes. Hits /api/cron/refresh-grid-carbon, which polls
 * the free UK Carbon Intensity API (carbonintensity.org.uk) for the
 * current GB-NATIONAL reading and today's half-hourly forecast, and
 * upserts them into grid_carbon_readings. The GridCarbonWidget on /pulse
 * reads from there.
 *
 * No upstream API key is required.
 *
 * Required env vars:
 *   - URL          (auto-provided by Netlify)
 *   - CRON_SECRET
 */
export const handler = schedule('*/30 * * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl || !cronSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'URL or CRON_SECRET missing' }),
    };
  }

  const target = `${baseUrl}/api/cron/refresh-grid-carbon`;
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
      console.error('Pulse grid-carbon cron failed:', res.status, body);
    } else {
      console.log('Pulse grid-carbon cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: any) {
    console.error('Pulse grid-carbon cron threw:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? 'Unknown error' }),
    };
  }
});
