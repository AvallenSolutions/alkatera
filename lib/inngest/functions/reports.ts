import 'server-only';
import { inngest } from '../client';
import {
  buildReportData,
  renderAndUploadPdf,
  reportsServiceClient,
} from '@/lib/reports/generate-sustainability-pdf';

/**
 * Sustainability report PDF generation, on Inngest. The old synchronous
 * route ran two corporate-emissions calcs, three Claude phases and PDFShift
 * in one POST (40-90s realistic) — over the platform's synchronous budget,
 * so users saw gateway timeouts after the AI/PDFShift spend was already
 * incurred. The dispatching route now just authorises and sends
 * 'reports/pdf.generate'; the frontend already polls generated_reports for
 * status + document_url, so no UI change was needed.
 *
 * Two steps so each fits one invocation and the large HTML string / PDF
 * buffer never crosses a step boundary:
 *   1. build-report-data       — queries + key findings + AI narratives
 *   2. render-and-upload-pdf   — HTML render, PDFShift, storage, completion
 */
export const reportPdfGenerate = inngest.createFunction(
  {
    id: 'report-pdf-generate',
    name: 'Generate sustainability report PDF',
    concurrency: { limit: 2 },
    retries: 1,
    triggers: [{ event: 'reports/pdf.generate' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { report_id: string };
      if (!original?.report_id) return;
      const supabase = reportsServiceClient();
      await supabase
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: `PDF generation failed: ${error.message}`.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.report_id);
    },
  },
  async ({ event, step }) => {
    const { report_id } = event.data as { report_id: string };

    const assembled = await step.run('build-report-data', async () => {
      return buildReportData(report_id);
    });

    const uploaded = await step.run('render-and-upload-pdf', async () => {
      return renderAndUploadPdf(report_id, assembled.config, assembled.reportData);
    });

    return { report_id, documentUrl: uploaded.documentUrl, pages: uploaded.pages };
  },
);
