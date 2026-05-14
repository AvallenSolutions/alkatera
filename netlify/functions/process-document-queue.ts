import { schedule } from '@netlify/functions';

/**
 * Distributor portal — document processing queue (Netlify Scheduled Function)
 *
 * Runs every 2 minutes. Hits /api/cron/process-document-queue, which
 * dequeues up to 3 document_processing_jobs and runs the document
 * processor against each (PDF / Excel / image → text → claude-sonnet-4-6
 * structured extraction → scraped_brand_data).
 *
 * Required env vars (set in Netlify → Site settings → Environment variables):
 *   - URL          (provided automatically by Netlify; canonical site URL)
 *   - CRON_SECRET  (must match the value the API route checks for)
 *
 * Cron "*\/2 * * * *" = every 2 minutes, UTC.
 */
export const handler = schedule('*/2 * * * *', async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'URL env var missing' }) };
  }
  if (!cronSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET env var missing' }) };
  }

  const target = `${baseUrl}/api/cron/process-document-queue`;

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
      console.error('Document queue cron failed:', res.status, body);
    } else {
      console.log('Document queue cron success:', body);
    }
    return { statusCode: res.status, body: JSON.stringify(body) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Document queue cron threw:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
});
