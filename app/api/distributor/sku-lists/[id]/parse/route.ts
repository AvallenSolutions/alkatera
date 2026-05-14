import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDistributor } from '@/lib/distributor/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { parsePdf } from '@/lib/distributor/parsers/pdf-parser';
import { suggestColumnMapping } from '@/lib/distributor/brand-normalizer';
import type { SkuListFileType, SkuListParseResult } from '@/types/distributor';

const PREVIEW_ROW_COUNT = 5;

/**
 * POST /api/distributor/sku-lists/[id]/parse
 * Downloads the uploaded file from Storage, dispatches to the right parser,
 * and returns the first 5 preview rows + detected columns + suggested
 * column mapping. Sets status='mapping'.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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

  const preview = parsed.rows.slice(0, PREVIEW_ROW_COUNT);
  const suggestions = suggestColumnMapping(parsed.headers);

  await auth.supabase
    .from('distributor_sku_lists')
    .update({
      status: 'mapping',
      row_count: parsed.rows.length,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const result: SkuListParseResult = {
    preview,
    detected_columns: parsed.headers,
    suggestions,
  };

  return NextResponse.json(result);
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('distributor_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
