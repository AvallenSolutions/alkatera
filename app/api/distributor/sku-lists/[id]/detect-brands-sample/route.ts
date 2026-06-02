import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';
import { parsePdf } from '@/lib/distributor/parsers/pdf-parser';
import { extractBrandsFromProductNames } from '@/lib/distributor/brand-extractor';
import type { SkuListFileType } from '@/types/distributor';

const SAMPLE_SIZE = 8;

/**
 * POST /api/distributor/sku-lists/[id]/detect-brands-sample
 * Body: { product_column: string }
 *
 * Runs AI brand detection on a small sample of the product column so the
 * upload wizard can show the distributor what auto-detection will do BEFORE
 * they commit to the full (background) import. Synchronous + tiny on purpose.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { product_column?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const productColumn = typeof body.product_column === 'string' ? body.product_column : '';
  if (!productColumn) {
    return NextResponse.json({ error: 'product_column required' }, { status: 400 });
  }

  const { data: row, error: rowError } = await auth.supabase
    .from('distributor_sku_lists')
    .select('file_path, file_type')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: download, error: downloadError } = await auth.supabase.storage
    .from('distributor-sku-lists')
    .download((row as { file_path: string }).file_path);
  if (downloadError || !download) {
    return NextResponse.json({ error: 'download_failed' }, { status: 500 });
  }

  const buffer = Buffer.from(await download.arrayBuffer());
  const fileType = (row as { file_type: SkuListFileType }).file_type;
  let parsed;
  try {
    if (fileType === 'csv') parsed = parseCSV(buffer.toString('utf-8'));
    else if (fileType === 'xlsx') parsed = parseExcel(buffer);
    else if (fileType === 'pdf') parsed = await parsePdf(buffer);
    else return NextResponse.json({ error: 'unsupported_file_type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
  }
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 422 });

  // First few distinct, non-empty product values.
  const seen = new Set<string>();
  const sample: string[] = [];
  for (const r of parsed.rows) {
    const v = (r[productColumn] ?? '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    sample.push(v);
    if (sample.length >= SAMPLE_SIZE) break;
  }

  const extraction = await extractBrandsFromProductNames(sample);
  const examples = sample.map((input) => {
    const e = extraction.get(input);
    return {
      input,
      brand: e?.is_product ? e.brand : null,
      product: e?.is_product ? e.product : null,
      is_product: e?.is_product ?? true,
    };
  });

  return NextResponse.json({ examples });
}
