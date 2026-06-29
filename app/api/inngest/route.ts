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
// maxDuration is the TOTAL budget. The real risk for long steps (e.g. the
// 60-90s Gemini grounded-search in deep-enrich / outreach enrich) is an
// INACTIVITY timeout: the platform proxy kills a connection that sends no
// bytes for too long, surfacing as a 504 "Inactivity Timeout" and a failed
// Inngest run. `streaming: true` makes the SDK stream keepalive data back to
// Inngest during a long step so the idle timer never fires — the documented
// fix for serverless/edge timeouts, and it also hardens the existing enrich.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
  streaming: true,
  // The SDK auto-detects the URL from request headers in production;
  // setting it explicitly in dev avoids the dev server printing a
  // misleading prefix. Inngest dev server runs at localhost:8288 by
  // default and discovers this endpoint via the configured signing.
  servePath: '/api/inngest',
});
