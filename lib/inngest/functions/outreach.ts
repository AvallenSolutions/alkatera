import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { enrichBrandForReport } from '@/lib/outreach/enrich-brand-for-report';
import { estimateBrandFootprint, type BrandFootprintInput } from '@/lib/outreach/brand-footprint-estimate';

/**
 * Background auto-enrich for an outbound brand report (Spec C).
 *
 * The generator returns the /r/[token] link instantly from typed inputs. This
 * job then sharpens the estimate by reading the brand's own website with a
 * fast, focused extraction (`enrichBrandForReport`) — NOT the heavy grounded
 * `deepEnrichBrand`, which ran 60-90s+ and tripped serverless timeouts. The
 * link and token never change; the report just gets the real category, country
 * and SKU sizes.
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

    const enrichment = await step.run('enrich-from-website', async () => {
      return enrichBrandForReport(report.brand_name, report.website);
    });

    return step.run('recompute-and-save', async () => {
      // Treat "no category and no products" as a failure, so the tool never
      // presents a bland fallback as a finished report.
      const hasData = !!enrichment.category || enrichment.products.length > 0;
      if (!hasData) {
        await supabase
          .from('brand_reports')
          .update({
            enrichment_status: 'failed',
            enrichment_error: (enrichment.error ?? 'no_brand_data_found').slice(0, 500),
          })
          .eq('id', report_id);
        return { report_id, enriched: false, reason: enrichment.error ?? 'no_brand_data_found' };
      }

      const input: BrandFootprintInput = {
        brandName: report.brand_name,
        category: enrichment.category,
        countryOfOrigin: enrichment.countryOfOrigin ?? report.country_of_origin,
        skus: enrichment.products.map((p) => ({ name: p.name, containerSizeMl: p.containerSizeMl })),
      };
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

      return { report_id, enriched: true, category: estimate.category, skus: estimate.skus.length };
    });
  },
);
