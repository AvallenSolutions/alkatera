import { schedule } from '@netlify/functions';

/**
 * Pulse — daily AI insight generator (Netlify Scheduled Function)
 *
 * Runs every day at 06:00 UTC. Hits /api/cron/generate-insights, which
 * iterates every org, gathers their latest snapshots / anomalies / targets,
 * asks Claude (Sonnet 4.6) for a fresh narrative, and writes it to
 * dashboard_insights. The InsightCard widget on /pulse reads from there.
 *
 * Cost note: ~one Sonnet call per org per day. Skips orgs with no snapshot
 * data, so cost scales with active orgs only.
 *
 * Required env vars:
 *   - URL                (auto-provided by Netlify)
 *   - CRON_SECRET        (matched against the API route)
 *   - ANTHROPIC_API_KEY  (read by the API route, not this function)
 */
export const handler = schedule('0 6 * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl || !cronSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'URL or CRON_SECRET missing' }),
    };
  }

  const target = `${baseUrl}/api/cron/generate-insights`;
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
      console.error('Pulse insights cron failed:', res.status, body);
    } else {
      console.log('Pulse insights cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: any) {
    console.error('Pulse insights cron threw:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? 'Unknown error' }),
    };
  }
});
