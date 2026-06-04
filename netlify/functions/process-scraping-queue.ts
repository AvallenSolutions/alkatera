import { schedule } from '@netlify/functions';

/**
 * Distributor portal — scraping queue tick (Netlify Scheduled Function)
 *
 * Runs every 5 minutes. Dispatches an Inngest event `scraping/queue.tick`
 * which the `scrapingQueueTick` function consumes — it claims queued
 * jobs and fans out one `scraping/brand.run` event per brand.
 *
 * Previously this hit the synchronous /api/cron/process-scraping-queue
 * route which was 300s-ceiling-bound and routinely left jobs stranded
 * when Netlify killed the function. Now the actual processing happens
 * on Inngest with step-level retries and no timeout pressure.
 *
 * Why the schedule fn still exists: Inngest doesn't have a built-in
 * cron primitive that talks to a custom event key set, so we keep a
 * single Netlify Schedule call as the heartbeat. It's tiny (one POST
 * to Inngest's ingest endpoint) and is bounded by Inngest's own
 * receipt-side retry policy.
 *
 * Required env vars in Netlify:
 *   - INNGEST_EVENT_KEY   for `inngest.send()`
 *   - INNGEST_SIGNING_KEY for incoming Inngest → /api/inngest auth
 *
 * The legacy /api/cron/process-scraping-queue route still exists as
 * a manual-trigger fallback (callable with CRON_SECRET) and is also
 * idempotent against the Inngest event-driven flow — running it by
 * hand simulates one tick.
 */
export const handler = schedule('*/5 * * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'scraping/queue.tick', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scraping-queue-tick] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
