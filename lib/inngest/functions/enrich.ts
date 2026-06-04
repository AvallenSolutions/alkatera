import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';
import { persistEnriched } from '@/lib/distributor/enrichment/persist';

/**
 * Deep-enrich, on Inngest. Replaces the
 * `netlify/functions/deep-enrich-background.ts` HMAC-signed background
 * function path with proper step-level retries.
 *
 * Why move it: the old path was a 15-min Netlify background fn that
 * still couldn't be relied on — when Gemini's grounded search
 * stalled (rare but real), the function timed out silently and the
 * deep_enrich_jobs row was stranded in 'searching' forever. Phase B's
 * auto-deep-enrich-every-brand would have multiplied this risk.
 *
 * Inngest gives us:
 *   - Step-level retries with exponential backoff (currently 2
 *     attempts on the Gemini step; the persistence pipeline downstream
 *     of the GET poll route is unchanged)
 *   - Up to 1h step ceiling (Gemini calls in the 60-90s range fit
 *     comfortably)
 *   - Observable run history per brand in the Inngest dashboard
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const enrichBrandRun = inngest.createFunction(
  {
    id: 'enrich-brand-run',
    name: 'Deep enrich one brand',
    // Cap to 4 simultaneous enrichments. Gemini grounded search has
    // per-key concurrency limits and we'd rather queue than 429.
    concurrency: { limit: 4 },
    // 2 retries on top of the initial attempt; transient Gemini
    // failures usually pass on retry. The persistence pipeline is
    // separate (in the GET poll route) so we don't risk
    // double-persisting findings on retry.
    retries: 2,
    triggers: [{ event: 'enrich/brand.run' }],
  },
  async ({ event, step }) => {
    const supabase = service();
    const eventData = event.data as { brand_directory_id: string; job_id: string };
    const { brand_directory_id, job_id } = eventData;

    // Load brand + existing products. If the brand has been deleted
    // since the event was enqueued, mark the job error and bail.
    const setup = await step.run('load-brand', async () => {
      const { data: brand } = await supabase
        .from('brand_directory')
        .select('id, name, website, country_of_origin, category, founding_year, parent_company, description')
        .eq('id', brand_directory_id)
        .maybeSingle();
      if (!brand) {
        await supabase
          .from('deep_enrich_jobs')
          .update({ status: 'error', error: 'brand_not_found', phase_message: null })
          .eq('id', job_id);
        return null;
      }
      const { data: existingRows } = await supabase
        .from('product_directory')
        .select('id, name')
        .eq('brand_directory_id', brand_directory_id)
        .order('name');
      await supabase
        .from('deep_enrich_jobs')
        .update({
          status: 'searching',
          phase_message: 'Searching authoritative sources for this brand…',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);
      return {
        brand: brand as {
          id: string;
          name: string;
          website: string | null;
          country_of_origin: string | null;
          category: string | null;
          founding_year: number | null;
          parent_company: string | null;
          description: string | null;
        },
        existingProducts: (existingRows ?? []) as Array<{ id: string; name: string }>,
      };
    });

    if (!setup) return { skipped: 'brand_not_found' };

    const enriched = await step.run('gemini-grounded-search', async () => {
      const result = await deepEnrichBrand({
        brandName: setup.brand.name,
        website: setup.brand.website,
        country: setup.brand.country_of_origin,
        category: setup.brand.category,
        existingBrand: {
          description: setup.brand.description,
          founding_year: setup.brand.founding_year,
          parent_company: setup.brand.parent_company,
        },
        existingProducts: setup.existingProducts,
      });
      return result;
    });

    const stashed = await step.run('stash-enriched-payload', async () => {
      if (
        enriched.error &&
        enriched.products.length === 0 &&
        enriched.documents.length === 0 &&
        enriched.credentials.length === 0 &&
        Object.keys(enriched.brand).length === 0
      ) {
        await supabase
          .from('deep_enrich_jobs')
          .update({
            status: 'error',
            error: enriched.error.slice(0, 500),
            phase_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job_id);
        return { stage: 'errored' as const };
      }
      await supabase
        .from('deep_enrich_jobs')
        .update({
          status: 'searched',
          phase_message: 'Persisting findings…',
          enriched,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);
      return { stage: 'searched' as const };
    });

    if (stashed.stage === 'errored') {
      return { job_id, brand_directory_id, persisted: false };
    }

    // Persistence step. Runs in the same Inngest function (rather than
    // waiting for an admin poll on the GET route) so auto-enrich
    // completes end-to-end without anyone watching. The admin GET
    // route still owns the manual-button persistence path.
    await step.run('persist-findings', async () => {
      // Atomic claim: don't double-persist if an admin happens to
      // poll the GET route at the same moment.
      const { data: claimed } = await supabase
        .from('deep_enrich_jobs')
        .update({ status: 'ingesting', phase_message: 'Persisting findings…' })
        .eq('id', job_id)
        .eq('status', 'searched')
        .select('id');
      if (!Array.isArray(claimed) || claimed.length !== 1) {
        return { skipped: 'claimed_by_another_handler' };
      }
      const result = await persistEnriched(supabase, brand_directory_id, enriched);
      await supabase
        .from('deep_enrich_jobs')
        .update({
          status: 'done',
          phase_message: null,
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job_id);
      return { persisted: true };
    });

    return { job_id, brand_directory_id, persisted: true };
  },
);
