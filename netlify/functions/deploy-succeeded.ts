import type { Handler } from '@netlify/functions';

/**
 * Netlify event-triggered function: fires automatically after every
 * successful deploy (the function name "deploy-succeeded" is the trigger).
 *
 * Wiki content ships with the deploy (wiki/pages/*.md), so a successful
 * production deploy is exactly the moment the wiki may have changed. This
 * hits the protected cron route that re-syncs the wiki into Rosa's knowledge
 * base. Preview and branch deploys are ignored.
 *
 * Required env vars (Netlify → Site settings → Environment variables):
 *   - URL          (provided automatically by Netlify; canonical site URL)
 *   - CRON_SECRET  (must match the value the API route checks for)
 */
export const handler: Handler = async (event) => {
  let deployContext = '';
  let branch = '';
  try {
    const payload = JSON.parse(event.body || '{}').payload || {};
    deployContext = payload.context || '';
    branch = payload.branch || '';
  } catch {
    // Fall through with empty context; treated as non-production below.
  }

  if (deployContext !== 'production') {
    console.log(`deploy-succeeded: skipping non-production deploy (context=${deployContext}, branch=${branch})`);
    return { statusCode: 200, body: 'skipped (not production)' };
  }

  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    console.error('deploy-succeeded: URL or CRON_SECRET env var missing');
    return { statusCode: 500, body: 'missing env vars' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/sync-wiki-to-rosa`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('deploy-succeeded: wiki sync failed', res.status, body);
      return { statusCode: 500, body: JSON.stringify(body) };
    }
    console.log('deploy-succeeded: wiki synced to Rosa', body);
    return { statusCode: 200, body: JSON.stringify(body) };
  } catch (error) {
    console.error('deploy-succeeded: wiki sync errored', error);
    return { statusCode: 500, body: 'sync request failed' };
  }
};
