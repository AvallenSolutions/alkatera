import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { assembleReportData, type ReportConfigShape } from '@/lib/reports/assemble-report-data';
import { buildNarratives } from '@/lib/reports/build-narratives';
import { hasNarrativeSnapshot } from '@/lib/reports/narrative-store';

// Re-exported for existing importers (generate-html route, build-screen-report).
export { buildReportConfig, type ReportConfigShape } from '@/lib/reports/assemble-report-data';

/**
 * Sustainability report PDF pipeline, extracted from the old synchronous
 * POST /api/reports/[id]/generate-pdf route so it can run inside an Inngest
 * function (lib/inngest/functions/reports.ts). The realistic happy path is
 * 40-90s (two corporate-emissions calcs + AI phases + PDFShift),
 * which blew the synchronous route budget: users saw gateway timeouts AFTER
 * the AI and PDFShift spend was already incurred.
 *
 * Split into two phases so each fits comfortably in one Inngest step and the
 * (large) HTML string / PDF buffer never crosses a step boundary:
 *   1. buildReportData  → shared assembly + AI narratives (JSON)
 *   2. renderAndUploadPdf → HTML render + PDFShift + storage upload + status
 *
 * Authorisation happens in the dispatching route; everything here uses the
 * service-role client.
 */

// This runs inside the /api/inngest route, where Next's patched fetch would
// otherwise cache outbound Supabase GETs across invocations. no-store keeps
// every read live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export function reportsServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });
}

/**
 * Phase 1: assemble report data (live queries, key findings, AI narratives).
 * Returns a JSON-serialisable payload safe to pass between Inngest steps.
 */
export async function buildReportData(reportId: string): Promise<{
  config: ReportConfigShape;
  reportData: Record<string, any>;
}> {
  const supabase = reportsServiceClient();

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select('*')
    .eq('id', reportId)
    .single();
  if (reportError || !report) {
    throw new Error(`Report not found: ${reportError?.message || reportId}`);
  }

  // Phase C: a reviewed draft supplies its narratives from the store; the
  // inline path remains for pre-Phase-C reports without a snapshot.
  if (hasNarrativeSnapshot(report)) {
    const snapshot = report.data_snapshot;
    const { config, reportData } = await assembleReportData(supabase, report, {
      skipKeyFindings: !!snapshot.keyFindings,
    });
    reportData.narratives = {
      executiveSummary: snapshot.narratives.executiveSummary,
      sections: snapshot.narratives.sections,
    };
    if (snapshot.keyFindings) {
      reportData.keyFindings = snapshot.keyFindings;
      reportData.dataAvailability.hasKeyFindings = true;
    }
    return { config, reportData };
  }

  const { config, reportData } = await assembleReportData(supabase, report);

  // AI narrative blocks for all included sections — fail gracefully
  try {
    const built = await buildNarratives({ config, reportData });
    reportData.narratives = {
      executiveSummary: built.executiveSummary,
      sections: built.sections,
    };
  } catch (narrativeErr) {
    console.error('[generate-pdf] Narrative generation failed (non-fatal):', narrativeErr);
    // Non-fatal — report generates without AI narratives
  }

  return { config, reportData };
}

/**
 * Phase 2: render HTML, convert via PDFShift, upload to storage and mark the
 * report completed. Returns the public document URL.
 */
export async function renderAndUploadPdf(
  reportId: string,
  config: ReportConfigShape,
  reportData: Record<string, any>,
): Promise<{ documentUrl: string; pages: number | null }> {
  const supabase = reportsServiceClient();

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select('id, organization_id')
    .eq('id', reportId)
    .single();
  if (reportError || !report) {
    throw new Error(`Report not found: ${reportError?.message || reportId}`);
  }

  // Progress signal for the polling UI (allowed statuses: pending,
  // aggregating_data, building_content, generating_document, completed, failed)
  await supabase
    .from('generated_reports')
    .update({ status: 'generating_document', updated_at: new Date().toISOString() })
    .eq('id', reportId);

  const html = renderSustainabilityReportHtml(config as any, reportData as any);

  const pdfResult = await convertHtmlToPdf(html, {
    format: 'A4',
    landscape: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    removeBlank: true,
  });

  // Path: reports/{orgId}/{reportId}.pdf — overwrites if report is regenerated
  const storagePath = `reports/${report.organization_id}/${reportId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('report-assets')
    .upload(storagePath, pdfResult.buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`PDF upload to storage failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('report-assets')
    .getPublicUrl(storagePath);
  const documentUrl = urlData.publicUrl;

  await supabase
    .from('generated_reports')
    .update({
      status: 'completed',
      document_url: documentUrl,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  return { documentUrl, pages: pdfResult.pages ?? null };
}
