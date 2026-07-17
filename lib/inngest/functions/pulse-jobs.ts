import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import {
  runSnapshotsSweep,
  runInsightsSweep,
  runAnomalyDetectionSweep,
  runShadowPriceRefresh,
} from '@/lib/pulse/cron-jobs';
import { refreshGridCarbonReadings } from '@/lib/integrations/uk-carbon-intensity';

/**
 * Pulse's five scheduled sweeps, on Inngest. Each replaces the
 * corresponding `/api/cron/*` route's Netlify Schedule trigger — the
 * routes stay in place as manual/admin fallbacks, both calling the same
 * lib/pulse/cron-jobs.ts implementations so there's exactly one copy of
 * each sweep's business logic.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const pulseGenerateSnapshots = inngest.createFunction(
  {
    id: 'pulse-generate-snapshots',
    name: 'Pulse: generate daily metric snapshots',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'pulse/snapshots.generate' }, { cron: '0 2 * * *' }],
  },
  async ({ step }) => step.run('run-snapshots-sweep', () => runSnapshotsSweep(service())),
);

export const pulseGenerateInsights = inngest.createFunction(
  {
    id: 'pulse-generate-insights',
    name: 'Pulse: generate daily AI insights',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'pulse/insights.generate' }, { cron: '0 6 * * *' }],
  },
  async ({ step }) =>
    step.run('run-insights-sweep', async () => {
      const result = await runInsightsSweep(service());
      // GEMINI_API_KEY missing is a graceful no-op, not a failure — same
      // behaviour as every other Gemini-dependent Inngest function.
      return result ?? { synced: 0, failed: 0, total: 0, failures: [], skipped: 'gemini_key_missing' };
    }),
);

export const pulseDetectAnomalies = inngest.createFunction(
  {
    id: 'pulse-detect-anomalies',
    name: 'Pulse: hourly anomaly detection',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'pulse/anomalies.detect' }, { cron: '0 * * * *' }],
  },
  async ({ step }) => step.run('run-anomaly-sweep', () => runAnomalyDetectionSweep(service())),
);

export const pulseRefreshGridCarbon = inngest.createFunction(
  {
    id: 'pulse-refresh-grid-carbon',
    name: 'Pulse: refresh UK grid-carbon readings',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'pulse/grid-carbon.refresh' }, { cron: '*/30 * * * *' }],
  },
  async ({ step }) => step.run('refresh-grid-carbon', () => refreshGridCarbonReadings(service())),
);

export const pulseRefreshShadowPrices = inngest.createFunction(
  {
    id: 'pulse-refresh-shadow-prices',
    name: 'Pulse: quarterly shadow-price refresh',
    concurrency: { limit: 1 },
    retries: 1,
    // Quarterly at 08:00 UTC on 1 Jan / 1 Apr / 1 Jul / 1 Oct.
    triggers: [{ event: 'pulse/shadow-prices.refresh' }, { cron: '0 8 1 1,4,7,10 *' }],
  },
  async ({ step }) => step.run('refresh-shadow-prices', () => runShadowPriceRefresh(service())),
);
