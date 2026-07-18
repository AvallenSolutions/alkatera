import type { SupabaseClient } from '@supabase/supabase-js';
import { renderSustainabilityReportHtml } from '@/lib/pdf/render-sustainability-report-html';
import { assembleReportData } from '@/lib/reports/assemble-report-data';
import { buildNarratives } from '@/lib/reports/build-narratives';
import { hasNarrativeSnapshot } from '@/lib/reports/narrative-store';

/**
 * Assemble data and render the screen-mode (interactive HTML) sustainability
 * report for a generated_reports row.
 *
 * Phase C: a reviewed draft supplies its narratives from the data_snapshot
 * store (so shipped documents carry the user's edited text verbatim); reports
 * without a snapshot keep the inline generation, gracefully skipped on
 * failure.
 *
 * Shared by the generate-html route and the share-link flow so both serve
 * the exact same document. The passed client determines visibility: routes
 * pass the user's RLS-scoped client so a user can only ever render what
 * they can already read.
 */
export async function buildScreenReportHtml(
  supabase: SupabaseClient,
  report: Record<string, any>
): Promise<string> {
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
    return renderSustainabilityReportHtml(config as any, reportData as any, { screenMode: true });
  }

  const { config, reportData } = await assembleReportData(supabase, report);

  try {
    const built = await buildNarratives({ config, reportData });
    reportData.narratives = {
      executiveSummary: built.executiveSummary,
      sections: built.sections,
    };
  } catch (narrativeErr) {
    console.error('[build-screen-report] Narrative generation failed (non-fatal):', narrativeErr);
  }

  return renderSustainabilityReportHtml(config as any, reportData as any, { screenMode: true });
}
