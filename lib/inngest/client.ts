import 'server-only';
import { Inngest } from 'inngest';

/**
 * Inngest is the standard for ALL background work in alka**tera**.
 * Never use raw Netlify Schedule functions for anything that could
 * exceed 30 seconds — the 300s sync ceiling has bitten us across
 * scraping, document processing, deep-enrich, find-websites and
 * brand-matching. Inngest gives us per-step retries with no hard
 * timeout, plus step-level observability and concurrency caps.
 *
 * The webhook handler lives at `app/api/inngest/route.ts` — every
 * function defined under `lib/inngest/functions/` is auto-registered
 * there. Send events with `inngest.send({ name: '...', data: { ... } })`
 * from any server route (page action, API route, cron tick, etc).
 *
 * The client gracefully no-ops when env vars are missing so local dev
 * and deploy-before-env-set both keep working. Configure for
 * production by adding to Netlify env:
 *   - INNGEST_EVENT_KEY    for `inngest.send()`
 *   - INNGEST_SIGNING_KEY  for incoming webhook verification
 */

/**
 * Event payload shapes. Adding a new event? Add it here and to the
 * relevant function in `lib/inngest/functions/`. The types are
 * informational — Inngest v4 doesn't enforce them at the client
 * level, but the functions read `event.data` against this contract
 * so keep it consistent.
 */
export interface AlkateraEvents {
  // ─────────── Scraping queue ───────────
  'scraping/queue.tick': { data: Record<string, never> };
  'scraping/brand.run': {
    data: {
      job_id: string;
      brand_profile_id: string | null;
      brand_directory_id: string | null;
    };
  };

  // ─────────── Document processing queue ───────────
  'documents/queue.tick': { data: Record<string, never> };
  'documents/process.one': {
    data: { submission_id: string; job_id: string };
  };

  // ─────────── Deep enrich ───────────
  'enrich/brand.run': {
    data: { brand_directory_id: string; job_id: string };
  };

  // ─────────── Brand matching ───────────
  'matching/sweep.run': { data: Record<string, never> };

  // ─────────── Monitoring ───────────
  'monitoring/openlca-cert.check': { data: Record<string, never> };

  // ─────────── Free-trial reminders ───────────
  'subscriptions/trial-reminder.sweep': { data: Record<string, never> };

  // ─────────── Xero scheduled sync ───────────
  'xero/sync.tick': { data: Record<string, never> };
  'xero/org.sync': { data: { organization_id: string } };

  // ─────────── Report generation ───────────
  'reports/pdf.generate': { data: { report_id: string } };

  // ─────────── Ingredient -> supplier-product matching ───────────
  'ingredients/match.suggest': {
    data: { organization_id: string; supplier_product_ids?: string[] };
  };

  // ─────────── Agribalyse food-factor backfill ───────────
  'factors/agribalyse.backfill': {
    data: { names?: string[] };
  };
}

const eventKey = process.env.INNGEST_EVENT_KEY;

export const inngest = new Inngest({
  id: 'alkatera',
  eventKey: eventKey ?? undefined,
});
