import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { suggestHeaderMapping } from '@/lib/shared/header-suggest';
import {
  BRAND_HEADER_ALIASES,
  PRODUCT_HEADER_ALIASES,
} from '@/lib/admin/directory/field-specs';

/**
 * POST /api/admin/directory/uploads/[id]/parse
 *
 * Re-reads the uploaded CSV/XLSX from storage, parses it, suggests a
 * column mapping based on the upload's `kind`, and returns a preview
 * (first ~5 rows) so the column-mapper UI can render with sensible
 * defaults.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  const { data: rowData, error: rowError } = await service
    .from('admin_directory_uploads')
    .select('id, file_path, file_type, kind, status')
    .eq('id', params.id)
    .maybeSingle();
  if (rowError || !rowData) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const row = rowData as {
    id: string;
    file_path: string;
    file_type: 'csv' | 'xlsx';
    kind: 'brands' | 'products';
    status: string;
  };

  const { data: download, error: downloadError } = await service.storage
    .from('admin-directory-uploads')
    .download(row.file_path);
  if (downloadError || !download) {
    return NextResponse.json(
      { error: 'download_failed', detail: downloadError?.message },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  let parsed: { rows: Record<string, string>[]; headers: string[]; error?: string };
  try {
    if (row.file_type === 'csv') {
      parsed = parseCSV(buffer.toString('utf-8'));
    } else {
      parsed = parseExcel(buffer);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    await service
      .from('admin_directory_uploads')
      .update({ status: 'error', error_message: message })
      .eq('id', row.id);
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }
  if (parsed.error) {
    await service
      .from('admin_directory_uploads')
      .update({ status: 'error', error_message: parsed.error })
      .eq('id', row.id);
    return NextResponse.json({ error: 'parse_failed', detail: parsed.error }, { status: 422 });
  }

  const aliases: Record<string, string[]> =
    row.kind === 'brands' ? BRAND_HEADER_ALIASES : PRODUCT_HEADER_ALIASES;
  const suggestions = suggestHeaderMapping(parsed.headers, aliases);

  // Stamp row_count + bump status to mapping.
  await service
    .from('admin_directory_uploads')
    .update({
      status: 'mapping',
      row_count: parsed.rows.length,
    })
    .eq('id', row.id);

  return NextResponse.json({
    preview: parsed.rows.slice(0, 5),
    detected_columns: parsed.headers,
    suggestions,
    row_count: parsed.rows.length,
    kind: row.kind,
  });
}
