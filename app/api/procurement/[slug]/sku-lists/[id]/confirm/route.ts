import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireProcurement } from '@/lib/procurement/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { parsePdf } from '@/lib/distributor/parsers/pdf-parser';
import { processProcurementSkuList } from '@/lib/procurement/sku-list-processor';
import { validateProcurementMapping } from '@/lib/procurement/column-mapping';
import type { ProcurementSkuListFileType } from '@/types/procurement';

/**
 * POST /api/procurement/[slug]/sku-lists/[id]/confirm
 * Body: { column_mapping: ProcurementColumnMapping }
 *
 * Re-reads the parsed file, resolves the distributor_channel column
 * against the procurement org's links, splits rows per distributor, and
 * runs the existing distributor processor against each group. Finally
 * inserts procurement_skus projection rows.
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await requireProcurement(params.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { column_mapping?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mapping = validateProcurementMapping(body.column_mapping);
  if (!mapping) {
    return NextResponse.json(
      {
        error: 'invalid_mapping',
        detail: 'brand_name, product_name and distributor_channel are required',
      },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await auth.supabase
    .from('procurement_sku_lists')
    .select('*')
    .eq('id', params.id)
    .eq('procurement_org_id', auth.organization.id)
    .maybeSingle();
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await auth.supabase
    .from('procurement_sku_lists')
    .update({
      status: 'processing',
      column_mapping: mapping,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const { data: download, error: downloadError } = await auth.supabase.storage
    .from('procurement-sku-lists')
    .download(row.file_path);
  if (downloadError || !download) {
    await markError(auth.supabase, params.id, `download_failed: ${downloadError?.message}`);
    return NextResponse.json(
      { error: 'download_failed', detail: downloadError?.message },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  const fileType = row.file_type as ProcurementSkuListFileType;

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

  const result = await processProcurementSkuList({
    supabase: auth.supabase,
    procurementOrgId: auth.organization.id,
    procurementSkuListId: params.id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileType,
    rows: parsed.rows,
    mapping,
    uploadedBy: auth.user.id,
  });

  await auth.supabase
    .from('procurement_sku_lists')
    .update({
      status: 'complete',
      row_count: parsed.rows.length,
      brand_count: result.brand_count,
      channel_summary: result.channel_summary,
      error_message:
        result.warnings.length > 0 ? result.warnings.slice(0, 5).join('\n') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json(result);
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('procurement_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
