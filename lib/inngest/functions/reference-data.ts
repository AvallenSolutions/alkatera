import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { getLoader } from '@/lib/external-data/registry';
import { loadFactorSet } from '@/lib/external-data/upsert';

/**
 * Reference-data loader (Foundation A).
 *
 * Loads a public emission-factor release (DESNZ GHG conversion factors first,
 * then USEEIO, ...) into the versioned factor_sets / reference_factors tables.
 * The loader produces its factors and the generic upsert handles version history
 * (supersede prior current set, insert new one). Idempotent: re-running the same
 * version refreshes its factors in place.
 *
 * Runs in Inngest so a slow load (or a future live gov.uk fetch+parse) never
 * blocks the admin request. concurrency 1 so two loads can't race the version
 * bookkeeping.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const referenceDataLoadRun = inngest.createFunction(
  {
    id: 'reference-data-load-run',
    name: 'Load external reference-data factor set',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'reference-data/load.requested' }],
  },
  async ({ event, step }) => {
    const loaderKey = (event.data as { loaderKey?: string })?.loaderKey;
    if (!loaderKey) throw new Error('reference-data/load.requested missing loaderKey');

    const loader = getLoader(loaderKey);
    if (!loader) throw new Error(`Unknown reference-data loader: ${loaderKey}`);

    const result = await step.run(`load-${loaderKey}`, async () => {
      const factors = await loader.load();
      const summary = await loadFactorSet(service(), loader.spec, factors);
      // eslint-disable-next-line no-console
      console.log(
        `[reference-data] loaded ${summary.provider} ${summary.version}: ` +
          `${summary.factorsInserted} factors` +
          (summary.supersededVersion ? ` (superseded ${summary.supersededVersion})` : ''),
      );
      return summary;
    });

    return result;
  },
);
