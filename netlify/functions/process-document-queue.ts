import { schedule } from '@netlify/functions';

/**
 * Distributor portal — document processing queue tick (Netlify Scheduled Function)
 *
 * Runs every 2 minutes. Dispatches an Inngest event `documents/queue.tick`
 * which the `documentsQueueTick` function consumes — it claims queued
 * document_processing_jobs and fans out one `documents/process.one`
 * event per document.
 *
 * Previously this hit the synchronous /api/cron/process-document-queue
 * route which was 300s-ceiling-bound. Now actual processing happens
 * on Inngest with step-level retries and no timeout pressure.
 *
 * Required env vars: INNGEST_EVENT_KEY for the send + INNGEST_SIGNING_KEY
 * for incoming Inngest → /api/inngest auth.
 *
 * The legacy /api/cron/process-document-queue route still exists as
 * a manual-trigger fallback.
 */
export const handler = schedule('*/2 * * * *', async () => {
  try {
    const { inngest } = await import('../../lib/inngest/client');
    await inngest.send({ name: 'documents/queue.tick', data: {} });
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[documents-queue-tick] inngest.send threw:', message);
    return { statusCode: 500, body: message };
  }
});
