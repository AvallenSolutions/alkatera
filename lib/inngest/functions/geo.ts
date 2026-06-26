import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { runSoilBaseline, type LandUnitType } from '@/lib/geo/soil-baseline';
import { lookupPoint } from '@/lib/geo/point-lookup';

/**
 * SoilGrids soil-carbon baseline (Foundation B).
 *
 * Triggered when a vineyard / orchard / arable field gets coordinates. Fetches
 * the SoilGrids organic-carbon-stock estimate (via the cached point-lookup) and
 * writes it as an unverified baseline sample. Runs in the background so the
 * external fetch never sits on the user's save request. Idempotent and safe to
 * re-run: it skips land units that already have a real measured sample and
 * refreshes its own prior baseline otherwise.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const geoSoilBaselineRun = inngest.createFunction(
  {
    id: 'geo-soil-baseline-run',
    name: 'SoilGrids soil-carbon baseline',
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: 'geo/soil-baseline.requested' }],
  },
  async ({ event, step }) => {
    const d = event.data as {
      organization_id: string;
      land_unit_type: LandUnitType;
      land_unit_id: string;
      lat: number;
      lng: number;
    };

    const baseline = await step.run('soil-baseline', async () => {
      const result = await runSoilBaseline(service(), {
        organizationId: d.organization_id,
        landUnitType: d.land_unit_type,
        landUnitId: d.land_unit_id,
        lat: d.lat,
        lng: d.lng,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[geo-soil-baseline] ${d.land_unit_type} ${d.land_unit_id}: ${result.status}` +
          (result.value != null ? ` ${result.value} tC/ha` : ''),
      );
      return result;
    });

    // Warm the land-cover cache so the map tab reads it instantly. Independent
    // of the soil baseline; a WorldCover failure must not fail the baseline.
    const landCover = await step.run('land-cover', async () => {
      try {
        const r = await lookupPoint(service(), { lat: d.lat, lng: d.lng, dataset: 'worldcover_lc' });
        // eslint-disable-next-line no-console
        console.log(`[geo-land-cover] ${d.land_unit_type} ${d.land_unit_id}: ${r.label ?? 'no data'}`);
        return { code: r.value, label: r.label };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[geo-land-cover] lookup failed:', e instanceof Error ? e.message : e);
        return { code: null, label: null };
      }
    });

    return { baseline, landCover };
  },
);
