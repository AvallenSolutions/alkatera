import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireProcurement } from '@/lib/procurement/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { parsePdf } from '@/lib/distributor/parsers/pdf-parser';
import { suggestProcurementColumnMapping } from '@/lib/procurement/column-mapping';
import { loadChannelLookup } from '@/lib/procurement/channel-resolver';
import type {
  ProcurementSkuListFileType,
  ProcurementSkuListParseResult,
} from '@/types/procurement';

const PREVIEW_ROW_COUNT = 5;

/**
 * POST /api/procurement/[slug]/sku-lists/[id]/parse
 * Downloads the uploaded file from Storage, dispatches to the right parser,
 * and returns the first 5 preview rows + detected columns + suggested
 * column mapping + known channels + channel values seen in the data.
 */
export async function POST(
  _request: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await requireProcurement(params.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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
  const suggestions = suggestProcurementColumnMapping(parsed.headers);

  // Surface channel values seen in the preview rows so the upload wizard
  // can show "we detected: hallgarten (3), enotria (2)" and the user can
  // catch typos before processing.
  const detectedChannelsSet = new Set<string>();
  if (suggestions.distributor_channel) {
    const col = suggestions.distributor_channel;
    for (const r of preview) {
      const v = (r[col] ?? '').trim();
      if (v) detectedChannelsSet.add(v);
    }
  }

  const { links } = await loadChannelLookup(auth.supabase, auth.organization.id);
  const knownChannels = links.map((l) => l.channelLabel);

  await auth.supabase
    .from('procurement_sku_lists')
    .update({
      status: 'mapping',
      row_count: parsed.rows.length,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const result: ProcurementSkuListParseResult = {
    preview,
    detected_columns: parsed.headers,
    suggestions,
    detected_channels: Array.from(detectedChannelsSet),
    known_channels: knownChannels,
  };

  return NextResponse.json(result);
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('procurement_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
