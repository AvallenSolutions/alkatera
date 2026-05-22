import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { processBulkBrands } from '@/lib/admin/directory/process-bulk-brands';
import { processBulkProducts } from '@/lib/admin/directory/process-bulk-products';

/**
 * POST /api/admin/directory/uploads/[id]/confirm
 * Body: { column_mapping: Record<string, string> }
 *
 * Re-reads the file, applies the column mapping, hands off to the
 * relevant bulk processor, and updates the upload row with the result
 * counts. Returns the same counts so the UI can render a summary.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  let body: { column_mapping?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.column_mapping || typeof body.column_mapping !== 'object') {
    return NextResponse.json({ error: 'invalid_mapping' }, { status: 400 });
  }
  const mapping = body.column_mapping as Record<string, string>;

  const { data: rowData } = await service
    .from('admin_directory_uploads')
    .select('id, file_path, file_type, kind, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!rowData) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const row = rowData as {
    id: string;
    file_path: string;
    file_type: 'csv' | 'xlsx';
    kind: 'brands' | 'products';
    status: string;
  };

  await service
    .from('admin_directory_uploads')
    .update({ status: 'processing', column_mapping: mapping })
    .eq('id', row.id);

  const { data: download, error: downloadError } = await service.storage
    .from('admin-directory-uploads')
    .download(row.file_path);
  if (downloadError || !download) {
    await markError(service, row.id, `download_failed: ${downloadError?.message}`);
    return NextResponse.json(
      { error: 'download_failed', detail: downloadError?.message },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  let parsed: { rows: Record<string, string>[]; headers: string[]; error?: string };
  try {
    parsed =
      row.file_type === 'csv' ? parseCSV(buffer.toString('utf-8')) : parseExcel(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    await markError(service, row.id, message);
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }
  if (parsed.error) {
    await markError(service, row.id, parsed.error);
    return NextResponse.json({ error: 'parse_failed', detail: parsed.error }, { status: 422 });
  }

  if (row.kind === 'brands') {
    const result = await processBulkBrands({
      service,
      rows: parsed.rows,
      mapping: mapping as Parameters<typeof processBulkBrands>[0]['mapping'],
    });
    await service
      .from('admin_directory_uploads')
      .update({
        status: 'complete',
        row_count: parsed.rows.length,
        brands_created: result.brands_created,
        brands_linked: result.brands_linked,
        error_message:
          result.errors.length > 0 ? result.errors.slice(0, 5).map(formatErr).join('\n') : null,
      })
      .eq('id', row.id);
    return NextResponse.json({
      kind: 'brands',
      row_count: parsed.rows.length,
      brands_created: result.brands_created,
      brands_linked: result.brands_linked,
      errors: result.errors,
    });
  }

  // products
  const result = await processBulkProducts({
    service,
    rows: parsed.rows,
    mapping: mapping as Parameters<typeof processBulkProducts>[0]['mapping'],
  });
  await service
    .from('admin_directory_uploads')
    .update({
      status: 'complete',
      row_count: parsed.rows.length,
      products_created: result.products_created,
      products_linked: result.products_linked,
      error_message:
        result.errors.length > 0 ? result.errors.slice(0, 5).map(formatErr).join('\n') : null,
    })
    .eq('id', row.id);
  return NextResponse.json({
    kind: 'products',
    row_count: parsed.rows.length,
    products_created: result.products_created,
    products_linked: result.products_linked,
    errors: result.errors,
  });
}

async function markError(
  service: SupabaseClient,
  id: string,
  message: string,
): Promise<void> {
  await service
    .from('admin_directory_uploads')
    .update({ status: 'error', error_message: message })
    .eq('id', id);
}

function formatErr(e: { row: number; brand?: string; error: string }): string {
  return `row ${e.row}${e.brand ? ` (${e.brand})` : ''}: ${e.error}`;
}
