import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';
import { enrichmentToEstimatorInput } from '@/lib/outreach/enrichment-adapter';
import { estimateBrandFootprint } from '@/lib/outreach/brand-footprint-estimate';

/**
 * Background auto-enrich for an outbound brand report (Spec C).
 *
 * The generator returns the /r/[token] link instantly from typed inputs. This
 * job then runs deepEnrichBrand (Gemini grounded search, ~60-90s — which is why
 * it MUST live on Inngest, never a sync route), maps the result to the estimator
 * input, recomputes the footprint and upgrades the stored snapshot. The link and
 * token never change; the report just gets sharper.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const outreachReportEnrich = inngest.createFunction(
  {
    id: 'outreach-report-enrich',
    name: 'Auto-enrich an outbound brand report',
    // Gemini grounded search has per-key concurrency limits; queue rather than 429.
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [{ event: 'outreach/report.enrich' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { report_id: string };
      if (!original?.report_id) return;
      const supabase = service();
      await supabase
        .from('brand_reports')
        .update({
          enrichment_status: 'failed',
          enrichment_error: `Failed after retries: ${error.message}`.slice(0, 500),
        })
        .eq('id', original.report_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { report_id } = event.data as { report_id: string };

    const report = await step.run('load-report', async () => {
      const { data } = await supabase
        .from('brand_reports')
        .select('id, brand_name, website, country_of_origin')
        .eq('id', report_id)
        .maybeSingle();
      if (!data) return null;
      await supabase
        .from('brand_reports')
        .update({ enrichment_status: 'running', enrichment_error: null })
        .eq('id', report_id);
      return data as {
        id: string;
        brand_name: string;
        website: string | null;
        country_of_origin: string | null;
      };
    });

    if (!report) return { skipped: 'report_not_found' };

    const enriched = await step.run('gemini-grounded-search', async () => {
      return deepEnrichBrand({
        brandName: report.brand_name,
        website: report.website,
        country: report.country_of_origin,
        category: null,
        existingBrand: { description: null, founding_year: null, parent_company: null },
        existingProducts: [],
      });
    });

    await step.run('recompute-and-save', async () => {
      const input = enrichmentToEstimatorInput(report.brand_name, enriched);
      const estimate = estimateBrandFootprint(input);
      await supabase
        .from('brand_reports')
        .update({
          inputs: input,
          estimate,
          category: estimate.category,
          country_of_origin: input.countryOfOrigin ?? report.country_of_origin,
          enrichment_status: 'done',
          enrichment_error: null,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', report_id);
      return { category: estimate.category, skus: estimate.skus.length };
    });

    return { report_id, enriched: true };
  },
);
