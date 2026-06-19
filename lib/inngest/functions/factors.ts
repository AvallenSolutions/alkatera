import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import {
  runAgribalyseBackfill,
  HOSPITALITY_FOOD_TARGETS,
} from '@/lib/openlca/agribalyse-backfill';

/**
 * Agribalyse food-factor backfill.
 *
 * Calculates cradle-to-gate factors for common restaurant food commodities from
 * the Agribalyse v3.2 gdt-server and upserts them into staging_emission_factors
 * so hospitality meal/drink ingredients resolve to real numbers.
 *
 * Each commodity needs a ~10-20s gdt-server calculation, so the work is chunked:
 * one Inngest step per chunk keeps each step well under the platform function
 * timeout and lets Inngest checkpoint progress (completed chunks are cached on
 * retry). Upserts are idempotent, so re-running is always safe.
 */

const CHUNK_SIZE = 5;

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const agribalyseBackfillRun = inngest.createFunction(
  {
    id: 'agribalyse-backfill-run',
    name: 'Backfill Agribalyse food factors',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'factors/agribalyse.backfill' }],
  },
  async ({ event, step }) => {
    const requested = (event.data as { names?: string[] })?.names;
    const targetNames = (
      requested
        ? HOSPITALITY_FOOD_TARGETS.filter((t) =>
            requested.some((n) => n.toLowerCase() === t.name.toLowerCase()),
          )
        : HOSPITALITY_FOOD_TARGETS
    ).map((t) => t.name);

    const chunks: string[][] = [];
    for (let i = 0; i < targetNames.length; i += CHUNK_SIZE) {
      chunks.push(targetNames.slice(i, i + CHUNK_SIZE));
    }

    let upserted = 0;
    let notFound = 0;
    let errors = 0;
    const perChunk: Array<{ upserted: number; notFound: number; errors: number }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const res = await step.run(`backfill-chunk-${i}`, async () => {
        const summary = await runAgribalyseBackfill({ supabase: service(), names: chunks[i] });
        for (const r of summary.results) {
          // eslint-disable-next-line no-console
          console.log(
            `[agribalyse-backfill] ${r.name}: ${r.status}` +
              (r.climate !== undefined ? ` ${r.climate.toFixed(3)} kgCO2e/kg` : '') +
              (r.processName ? ` <- ${r.processName}` : '') +
              (r.error ? ` ERROR: ${r.error}` : ''),
          );
        }
        return { upserted: summary.upserted, notFound: summary.notFound, errors: summary.errors };
      });
      upserted += res.upserted;
      notFound += res.notFound;
      errors += res.errors;
      perChunk.push(res);
    }

    return { targets: targetNames.length, upserted, notFound, errors };
  },
);
