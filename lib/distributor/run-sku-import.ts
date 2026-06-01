import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCSV } from './parsers/csv-parser';
import { parseExcel } from './parsers/excel-parser';
import { parsePdf } from './parsers/pdf-parser';
import { processSkuList, type ImportProgressPhase } from './sku-list-processor';
import { queueBrandsForScraping } from './scraping/agent-dispatcher';
import type { ColumnMapping, SkuListFileType } from '@/types/distributor';

/**
 * The completion-screen payload the upload wizard renders. Stored on
 * distributor_sku_lists.import_result so the client can read it after
 * polling the row to status='complete'.
 */
export interface SkuImportResult {
  brand_count: number;
  sku_count: number;
  row_count: number;
  scraping_queued: number;
  scraping_skipped_directory_hit: number;
  warnings: string[];
  directory_matches: Array<Record<string, unknown>>;
  product_directory_stats: { resolved: number; matched_existing: number; created_new: number };
}

/**
 * Heavy SKU-import worker. Runs OUTSIDE the request/response cycle (Netlify
 * background function in prod, in-process in dev) so the ~1-2k serial DB
 * round-trips a real distributor catalogue generates don't trip Netlify's
 * function time limit and 504 the import.
 *
 * Requires a SERVICE-ROLE client: processSkuList does cross-row reads/writes
 * that RLS would otherwise block.
 *
 * Writes status='complete' + import_result (or status='error' + error_message)
 * onto the distributor_sku_lists row. The upload wizard polls that row.
 *
 * Note: alkatera auto-matching is intentionally NOT run here — the completion
 * screen doesn't surface it and the daily run-brand-matching cron self-discovers
 * every brand_profile with a null alkatera_org_id, so it gets matched there.
 */
export async function runSkuImport(args: {
  supabase: SupabaseClient;
  skuListId: string;
  distributorOrgId: string;
  mapping: ColumnMapping;
}): Promise<SkuImportResult> {
  const { supabase, skuListId, distributorOrgId, mapping } = args;

  const { data: row, error: rowError } = await supabase
    .from('distributor_sku_lists')
    .select('*')
    .eq('id', skuListId)
    .eq('distributor_org_id', distributorOrgId)
    .maybeSingle();
  if (rowError || !row) {
    throw new Error(rowError?.message ?? 'sku_list_not_found');
  }

  const { data: download, error: downloadError } = await supabase.storage
    .from('distributor-sku-lists')
    .download((row as { file_path: string }).file_path);
  if (downloadError || !download) {
    await markError(supabase, skuListId, `download_failed: ${downloadError?.message}`);
    throw new Error(`download_failed: ${downloadError?.message}`);
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  const fileType = (row as { file_type: SkuListFileType }).file_type;

  let parsed: Awaited<ReturnType<typeof parsePdf>> | ReturnType<typeof parseCSV>;
  try {
    if (fileType === 'csv') {
      parsed = parseCSV(buffer.toString('utf-8'));
    } else if (fileType === 'xlsx') {
      parsed = parseExcel(buffer);
    } else if (fileType === 'pdf') {
      parsed = await parsePdf(buffer);
    } else {
      await markError(supabase, skuListId, 'unsupported_file_type');
      throw new Error('unsupported_file_type');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    await markError(supabase, skuListId, message);
    throw new Error(message);
  }

  if (parsed.error) {
    await markError(supabase, skuListId, parsed.error);
    throw new Error(parsed.error);
  }

  // Throttled progress reporter. processSkuList calls this from inside its
  // serial loops (~one call per brand/product); we coalesce those into at most
  // one row write every ~700ms so the wizard's progress bar moves smoothly
  // without hammering the DB with hundreds of updates.
  let lastWriteAt = 0;
  let lastPhase = '';
  async function reportProgress(phase: ImportProgressPhase, current: number, total: number) {
    const { label, percent } = describeProgress(phase, current, total);
    const now = Date.now();
    const phaseChanged = phase !== lastPhase;
    const atEnd = total > 0 && current >= total;
    if (!phaseChanged && !atEnd && now - lastWriteAt < 700) return;
    lastWriteAt = now;
    lastPhase = phase;
    await supabase
      .from('distributor_sku_lists')
      .update({
        import_result: { kind: 'progress', phase, label, current, total, percent },
        updated_at: new Date().toISOString(),
      })
      .eq('id', skuListId);
  }

  const result = await processSkuList({
    supabase,
    distributorOrgId,
    skuListId,
    rows: parsed.rows,
    mapping,
    onProgress: reportProgress,
  });

  // Finishing phase: scraping queue + directory enrichment.
  await supabase
    .from('distributor_sku_lists')
    .update({
      import_result: {
        kind: 'progress',
        phase: 'finishing',
        label: 'Finishing up…',
        current: 0,
        total: 0,
        percent: 97,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', skuListId);

  // Kick off Phase 2 scraping for every touched brand. Best-effort —
  // failure here must not fail the import (the cron retries).
  let scraping_queued = 0;
  let scraping_skipped_directory_hit = 0;
  if (result.brand_profile_ids.length > 0) {
    try {
      const queueResult = await queueBrandsForScraping({
        supabase,
        distributorOrgId,
        brandProfileIds: result.brand_profile_ids,
        triggeredBy: 'sku_import',
      });
      scraping_queued = queueResult.queued;
      scraping_skipped_directory_hit = queueResult.skipped_directory_hit;
    } catch {
      // swallow — scraping_jobs may not exist in some envs.
    }
  }

  // Enrich each directory match with the signals the wizard surfaces
  // ("already has data on file", "on alkatera"). Single query, small N.
  const directoryIds = Array.from(new Set(result.directory_matches.map((m) => m.directory_id)));
  type DirectoryEnrichment = {
    id: string;
    alkatera_org_id: string | null;
    completeness_score: number | null;
    sustainability_score: number | null;
    score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  };
  let enrichmentById = new Map<string, DirectoryEnrichment>();
  if (directoryIds.length > 0) {
    const { data: directoryRows } = await supabase
      .from('brand_directory')
      .select('id, alkatera_org_id, completeness_score, sustainability_score, score_tier')
      .in('id', directoryIds);
    enrichmentById = new Map(
      ((directoryRows ?? []) as DirectoryEnrichment[]).map((r) => [r.id, r]),
    );
  }

  const enrichedMatches = result.directory_matches.map((m) => {
    const e = enrichmentById.get(m.directory_id);
    return {
      ...m,
      on_alkatera: !!e?.alkatera_org_id,
      completeness_score: e?.completeness_score ?? null,
      sustainability_score: e?.sustainability_score ?? null,
      score_tier: e?.score_tier ?? null,
      has_data_on_file: !!e && ((e.completeness_score ?? 0) > 0 || !!e.alkatera_org_id),
    };
  });

  const importResult: SkuImportResult = {
    brand_count: result.brand_count,
    sku_count: result.sku_count,
    row_count: parsed.rows.length,
    scraping_queued,
    scraping_skipped_directory_hit,
    warnings: result.errors,
    directory_matches: enrichedMatches,
    product_directory_stats: result.product_directory_stats,
  };

  await supabase
    .from('distributor_sku_lists')
    .update({
      status: 'complete',
      row_count: parsed.rows.length,
      brand_count: result.brand_count,
      import_result: importResult,
      error_message: result.errors.length > 0 ? result.errors.slice(0, 5).join('\n') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', skuListId);

  return importResult;
}

/**
 * Map a processing phase + its in-phase counter to an overall 0-100 percent
 * and a human label. Phases get weighted bands roughly proportional to how
 * long they take (brand + product matching are the serial-RPC heavy hitters).
 */
function describeProgress(
  phase: ImportProgressPhase,
  current: number,
  total: number,
): { label: string; percent: number } {
  const frac = total > 0 ? Math.min(1, current / total) : 0;
  const band = (start: number, end: number) => Math.round(start + frac * (end - start));
  switch (phase) {
    case 'matching_brands':
      return { label: `Matching brands to the directory… (${current}/${total})`, percent: band(5, 45) };
    case 'saving_brands':
      return { label: `Saving brand profiles… (${current}/${total})`, percent: band(45, 60) };
    case 'matching_products':
      return { label: `Matching products to the catalogue… (${current}/${total})`, percent: band(60, 88) };
    case 'saving_skus':
      return { label: 'Saving SKUs…', percent: band(88, 96) };
    default:
      return { label: 'Working…', percent: 5 };
  }
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('distributor_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
