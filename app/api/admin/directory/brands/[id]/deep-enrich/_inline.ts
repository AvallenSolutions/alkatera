import type { SupabaseClient } from '@supabase/supabase-js';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';

/**
 * Local-dev fallback for the deep-enrich worker. Only imported dynamically
 * from route.ts when the Inngest dispatch fails and we're not in
 * production, so the Anthropic SDK + the comprehensive enrichment prompt
 * don't get bundled into the production lambda for this route.
 *
 * In production (and whenever an Inngest dev server is running locally),
 * the `enrich/brand.run` Inngest function (lib/inngest/functions/enrich.ts)
 * does the same work with proper step-level retries.
 */
export async function runInline(service: SupabaseClient, jobId: string): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    service
      .from('deep_enrich_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  try {
    const { data: job } = await service
      .from('deep_enrich_jobs')
      .select('brand_directory_id')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) {
      await update({ status: 'error', error: 'job_not_found', phase_message: null });
      return;
    }
    const brandDirectoryId = (job as { brand_directory_id: string }).brand_directory_id;

    const { data: brand } = await service
      .from('brand_directory')
      .select(
        'id, name, website, country_of_origin, category, founding_year, parent_company, description',
      )
      .eq('id', brandDirectoryId)
      .maybeSingle();
    if (!brand) {
      await update({ status: 'error', error: 'brand_not_found', phase_message: null });
      return;
    }
    const directory = brand as {
      id: string;
      name: string;
      website: string | null;
      country_of_origin: string | null;
      category: string | null;
      founding_year: number | null;
      parent_company: string | null;
      description: string | null;
    };

    const { data: existingRows } = await service
      .from('product_directory')
      .select('id, name')
      .eq('brand_directory_id', directory.id)
      .order('name');
    const existingProducts = ((existingRows ?? []) as Array<{ id: string; name: string }>);

    await update({ status: 'searching', phase_message: 'Searching the web for this brand…' });

    const enriched = await deepEnrichBrand({
      brandName: directory.name,
      website: directory.website,
      country: directory.country_of_origin,
      category: directory.category,
      existingBrand: {
        description: directory.description,
        founding_year: directory.founding_year,
        parent_company: directory.parent_company,
      },
      existingProducts,
    });

    if (
      enriched.error &&
      enriched.products.length === 0 &&
      enriched.documents.length === 0 &&
      enriched.credentials.length === 0 &&
      Object.keys(enriched.brand).length === 0
    ) {
      await update({ status: 'error', error: enriched.error.slice(0, 500), phase_message: null });
      return;
    }
    await update({
      status: 'searched',
      phase_message: 'Persisting findings…',
      enriched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await update({ status: 'error', error: message.slice(0, 500), phase_message: null });
  }
}
