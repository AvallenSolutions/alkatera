import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { allFunctions } from '@/lib/inngest/functions';

/**
 * Inngest webhook endpoint. Inngest hits this URL to invoke our
 * functions; we register every function defined under
 * `lib/inngest/functions/` via the central registry.
 *
 * No auth on this route — Inngest signs every request with the
 * INNGEST_SIGNING_KEY env var and the SDK verifies the signature
 * before invoking any handler. Set both INNGEST_EVENT_KEY (for
 * `inngest.send()`) and INNGEST_SIGNING_KEY (for incoming webhook
 * verification) in Netlify env to enable production routing.
 */

export const runtime = 'nodejs';
// Inngest steps stream — needs a generous time budget but typically
// returns in seconds because each step is short. The function-level
// retries + concurrency caps are configured per-function in
// lib/inngest/functions/*.ts.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
  // The SDK auto-detects the URL from request headers in production;
  // setting it explicitly in dev avoids the dev server printing a
  // misleading prefix. Inngest dev server runs at localhost:8288 by
  // default and discovers this endpoint via the configured signing.
  servePath: '/api/inngest',
});
