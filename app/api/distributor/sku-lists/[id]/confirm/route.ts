import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDistributor } from '@/lib/distributor/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { parsePdf } from '@/lib/distributor/parsers/pdf-parser';
import { processSkuList } from '@/lib/distributor/sku-list-processor';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';
import { attemptAutoMatch } from '@/lib/distributor/integration/linker';
import type { ColumnMapping, SkuListFileType } from '@/types/distributor';

/**
 * POST /api/distributor/sku-lists/[id]/confirm
 * Body: { column_mapping: ColumnMapping }
 *
 * Persists the chosen column mapping, re-reads the file, normalises brand
 * names, upserts brand_profiles, and inserts brand_skus. Updates the
 * upload row with row_count + brand_count and sets status='complete' on
 * success, 'error' on failure.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { column_mapping?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mapping = validateMapping(body.column_mapping);
  if (!mapping) {
    return NextResponse.json(
      { error: 'invalid_mapping', detail: 'brand_name and product_name are required' },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await auth.supabase
    .from('distributor_sku_lists')
    .select('*')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await auth.supabase
    .from('distributor_sku_lists')
    .update({
      status: 'processing',
      column_mapping: mapping,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const { data: download, error: downloadError } = await auth.supabase.storage
    .from('distributor-sku-lists')
    .download(row.file_path);
  if (downloadError || !download) {
    await markError(auth.supabase, params.id, `download_failed: ${downloadError?.message}`);
    return NextResponse.json(
      { error: 'download_failed', detail: downloadError?.message },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  const fileType = row.file_type as SkuListFileType;

  let parsed;
  try {
    if (fileType === 'csv') {
      parsed = parseCSV(buffer.toString('utf-8'));
    } else if (fileType === 'xlsx') {
      parsed = parseExcel(buffer);
    } else if (fileType === 'pdf') {
      parsed = await parsePdf(buffer);
    } else {
      await markError(auth.supabase, params.id, 'unsupported_file_type');
      return NextResponse.json({ error: 'unsupported_file_type' }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    await markError(auth.supabase, params.id, message);
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }

  if (parsed.error) {
    await markError(auth.supabase, params.id, parsed.error);
    return NextResponse.json({ error: 'parse_failed', detail: parsed.error }, { status: 422 });
  }

  const result = await processSkuList({
    supabase: auth.supabase,
    distributorOrgId: auth.organization.id,
    skuListId: params.id,
    rows: parsed.rows,
    mapping,
  });

  await auth.supabase
    .from('distributor_sku_lists')
    .update({
      status: 'complete',
      row_count: parsed.rows.length,
      brand_count: result.brand_count,
      error_message: result.errors.length > 0 ? result.errors.slice(0, 5).join('\n') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  // Kick off Phase 2 scraping for every brand profile this import
  // touched (new or existing). Best-effort — if it fails we don't break
  // the import. The cron picks up queued jobs every 5 minutes.
  let scraping_queued = 0;
  if (result.brand_profile_ids.length > 0) {
    try {
      const queueResult = await queueBrandsForScraping({
        supabase: auth.supabase,
        distributorOrgId: auth.organization.id,
        brandProfileIds: result.brand_profile_ids,
        triggeredBy: 'sku_import',
      });
      scraping_queued = queueResult.queued;
    } catch {
      // swallow — the scraping_jobs table may not exist yet in dev
      // environments where Phase 2 migration hasn't been applied.
    }
  }

  // Attempt Phase 6 alkatera matching for each new/touched brand.
  // High-confidence matches auto-link; lower-confidence file a
  // "pending match" notification. Best-effort so a missing Phase 6
  // migration doesn't break the import.
  let matched = 0;
  let suggested = 0;
  if (result.brand_profile_ids.length > 0) {
    try {
      const { data: brandRows } = await auth.supabase
        .from('brand_profiles')
        .select('id, name, normalized_name, website')
        .in('id', result.brand_profile_ids);
      for (const b of (brandRows ?? []) as Array<{
        id: string;
        name: string;
        normalized_name: string;
        website: string | null;
      }>) {
        const outcome = await attemptAutoMatch(auth.supabase, {
          id: b.id,
          name: b.name,
          normalized_name: b.normalized_name,
          website: b.website,
        });
        if (outcome.action === 'linked') matched += 1;
        else if (outcome.action === 'suggested') suggested += 1;
      }
    } catch {
      // Phase 6 migration may not be applied — swallow.
    }
  }

  // Enrich each directory match with signals that tell the distributor
  // why this matters: "you didn't need to wait for scraping, this brand
  // already has data on file". Single query, small N.
  const directoryIds = Array.from(
    new Set(result.directory_matches.map((m) => m.directory_id)),
  );
  type DirectoryEnrichment = {
    id: string;
    alkatera_org_id: string | null;
    completeness_score: number | null;
    sustainability_score: number | null;
    score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  };
  let enrichmentById = new Map<string, DirectoryEnrichment>();
  if (directoryIds.length > 0) {
    const { data: directoryRows } = await auth.supabase
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

  return NextResponse.json({
    brand_count: result.brand_count,
    sku_count: result.sku_count,
    row_count: parsed.rows.length,
    scraping_queued,
    alkatera_auto_linked: matched,
    alkatera_suggested: suggested,
    warnings: result.errors,
    directory_matches: enrichedMatches,
  });
}

function validateMapping(input: unknown): ColumnMapping | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.brand_name !== 'string' || !obj.brand_name) return null;
  if (typeof obj.product_name !== 'string' || !obj.product_name) return null;
  const mapping: ColumnMapping = {
    brand_name: obj.brand_name,
    product_name: obj.product_name,
  };
  for (const field of ['sku_code', 'category', 'country_of_origin', 'listing_status'] as const) {
    if (typeof obj[field] === 'string' && obj[field]) {
      mapping[field] = obj[field] as string;
    }
  }
  return mapping;
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('distributor_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
