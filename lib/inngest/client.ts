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

  // ─────────── Smart-upload: background forced-type reclassify (large files) ───────────
  'ingest/reclassify.run': {
    data: { job_id: string; target_type: string };
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

  // ─────────── External reference-data loaders (Foundation A) ───────────
  'reference-data/load.requested': {
    data: { loaderKey: string };
  };

  // ─────────── Geospatial soil-carbon baseline (Foundation B) ───────────
  'geo/soil-baseline.requested': {
    data: {
      organization_id: string;
      land_unit_type: 'vineyard' | 'orchard' | 'arable_field';
      land_unit_id: string;
      lat: number;
      lng: number;
    };
  };

  // ─────────── Pulse on-demand refresh ───────────
  'pulse/refresh.requested': {
    data: { run_id: string; base_url: string };
  };

  // ─────────── LCA: recalculate a product footprint server-side ───────────
  // base_url is required, not optional: the waterfall reaches OpenLCA and the
  // supplier resolver over HTTP, and Node cannot resolve the relative paths
  // the browser path uses.
  'lca/recalc.requested': {
    data: { run_id: string; base_url: string };
  };

  // ─────────── Outbound reply-hook: background brand-report enrich ───────────
  'outreach/report.enrich': {
    data: { report_id: string };
  };

  // ─────────── Growth score: "forest gone quiet" stall sweep ───────────
  'growth/stall.check': { data: Record<string, never> };

  // ─────────── Email-in intake: poll the IMAP mailbox ───────────
  'email/intake.poll': { data: Record<string, never> };

  // ─────────── Rosa learning: weekly curation sweep (Pillar 4 step 2) ───────────
  'rosa/learning.sweep': { data: Record<string, never> };

  // ─────────── Product import: "Import from website" ───────────
  'products/import-from-url.run': {
    data: { job_id: string; url: string };
  };

  // ─────────── Smart Upload: background classify (large files) ───────────
  'ingest/auto.run': {
    data: { job_id: string };
  };

  // ─────────── Admin directory: web-search brand sourcing ───────────
  'directory/sourcing.run': {
    data: { job_id: string };
  };

  // ─────────── Distributor: find brand websites backfill ───────────
  'distributor/find-websites.run': {
    data: {
      distributor_org_id: string;
      brand_profile_id: string | null;
      run_id: string | null;
    };
  };

  // ─────────── Distributor: process an uploaded SKU list ───────────
  'distributor/sku-import.run': {
    data: {
      sku_list_id: string;
      distributor_org_id: string;
      mapping: Record<string, unknown>;
    };
  };

  // ─────────── Distributor: alkatera live-data sync queue drain ───────────
  'distributor/alkatera-sync-queue.tick': { data: Record<string, never> };

  // ─────────── Distributor: outreach reminder sweep ───────────
  'distributor/reminder-sweep.run': { data: Record<string, never> };

  // ─────────── Pulse: scheduled sweeps ───────────
  'pulse/snapshots.generate': { data: Record<string, never> };
  'pulse/insights.generate': { data: Record<string, never> };
  'pulse/anomalies.detect': { data: Record<string, never> };
  'pulse/grid-carbon.refresh': { data: Record<string, never> };
  'pulse/shadow-prices.refresh': { data: Record<string, never> };

  // ─────────── Retention: purge sweep ───────────
  'retention/purge.sweep': { data: Record<string, never> };

  // ─────────── Wiki -> Rosa knowledge-base sync ───────────
  'wiki/sync.tick': { data: Record<string, never> };

  // ─────────── Internal benchmarks: cohort backfill ───────────
  'benchmarks/intensity.backfill': { data: Record<string, never> };
}

const eventKey = process.env.INNGEST_EVENT_KEY;

export const inngest = new Inngest({
  id: 'alkatera',
  eventKey: eventKey ?? undefined,
});
