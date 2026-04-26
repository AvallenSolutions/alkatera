import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import pdfParse from 'pdf-parse';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import {
  buildExtractionRequest,
  detectMode,
  parseExtractionResponse,
  type ExtractionMode,
  type ExtractionResult,
} from '@/lib/extraction/supplier-product-extractor';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STORAGE_BUCKET = 'supplier-product-evidence';
const DEDUPE_WINDOW_HOURS = 24;
const DEFAULT_DAILY_CAP = 20;

function detectSource(filename: string): 'pdf' | 'csv' | 'xlsx' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return null;
}

/**
 * POST /api/supplier-products/smart-import
 *
 * Body: multipart FormData
 *   file: File (PDF | CSV | XLSX)
 *   supplier_id: string (uuid)
 *
 * Flow (v1, synchronous):
 *   1. Verify caller owns the supplier.
 *   2. SHA-256 the file. If a recent (< 24h) completed job exists for
 *      (supplier_id, file_hash), return its jobId — no re-billing.
 *   3. Enforce daily extraction cap per supplier.
 *   4. Upload file to supplier-product-evidence/{supplier_id}/imports/...
 *   5. Insert job row.
 *   6. Parse the file (pdf-parse / xlsx / csv) and call Claude Sonnet with
 *      the structured-output tool. Write the extracted products back to the
 *      job row. Return { jobId } 202.
 *
 * The Netlify background-function path replaces step 6 in step 5 of the
 * implementation order — the route shape (POST → poll → confirm) stays the same.
 */
export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const supplierId = (formData.get('supplier_id') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
    if (!supplierId) return NextResponse.json({ error: 'supplier_id is required' }, { status: 400 });

    const source = detectSource(file.name);
    if (!source) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, CSV, or XLSX file.' },
        { status: 400 }
      );
    }

    // Authorise: caller must own the supplier (suppliers.user_id) or be a
    // member of the supplier's org. The service-role client lets us check
    // both without RLS getting in the way.
    const { data: supplier, error: supplierError } = await (client as any)
      .from('suppliers')
      .select('id, organization_id, user_id')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const isOwner = supplier.user_id === user.id;
    let isOrgMember = false;
    if (!isOwner && supplier.organization_id) {
      const { data: membership } = await (client as any)
        .from('organization_members')
        .select('id')
        .eq('organization_id', supplier.organization_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Dedupe: completed job for the same (supplier_id, file_hash) within 24h
    // skips re-billing. The client polls the cached job and gets the cached
    // products straight away.
    const dedupeCutoff = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: cachedJob } = await (client as any)
      .from('supplier_product_import_jobs')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('file_hash', fileHash)
      .eq('status', 'completed')
      .gte('created_at', dedupeCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedJob?.id) {
      return NextResponse.json({ jobId: cachedJob.id, cached: true }, { status: 200 });
    }

    // Daily extraction cap per supplier — keeps a runaway from racking up
    // Anthropic charges. Tunable via SUPPLIER_SMART_IMPORT_DAILY_CAP.
    const dayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyCap = Number(process.env.SUPPLIER_SMART_IMPORT_DAILY_CAP) || DEFAULT_DAILY_CAP;
    const { count: jobsToday } = await (client as any)
      .from('supplier_product_import_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .gte('created_at', dayCutoff)
      .in('status', ['completed', 'extracting', 'parsing']);
    if ((jobsToday ?? 0) >= dailyCap) {
      return NextResponse.json(
        { error: `Daily smart-import limit (${dailyCap}) reached for this supplier. Try again tomorrow.` },
        { status: 429 }
      );
    }

    // Insert job row first so we have a stable id for the storage path.
    const { data: job, error: insertError } = await (client as any)
      .from('supplier_product_import_jobs')
      .insert({
        supplier_id: supplierId,
        user_id: user.id,
        organization_id: supplier.organization_id ?? null,
        source,
        file_storage_path: '', // filled below
        file_hash: fileHash,
        status: 'pending',
        phase_message: 'Uploading file…',
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error('[smart-import] job insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to start import' }, { status: 500 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const storagePath = `${supplierId}/imports/${job.id}-${safeName}`;
    const { error: uploadError } = await (client as any).storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || (source === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
        upsert: false,
      });

    if (uploadError) {
      console.error('[smart-import] storage upload failed:', uploadError);
      await (client as any)
        .from('supplier_product_import_jobs')
        .update({ status: 'failed', error: `Upload failed: ${uploadError.message}` })
        .eq('id', job.id);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    await (client as any)
      .from('supplier_product_import_jobs')
      .update({ file_storage_path: storagePath, status: 'parsing', phase_message: 'Parsing file…' })
      .eq('id', job.id);

    // === Extract synchronously (v1) ============================================
    // The plan calls for a Netlify -background function in step 5; for now we
    // run extraction inline. PDFs typically parse + extract in <30s — within
    // the maxDuration cap on this route.
    let result: ExtractionResult;
    try {
      const { content, mode } = await readContent(source, buffer);

      await (client as any)
        .from('supplier_product_import_jobs')
        .update({ status: 'extracting', phase_message: 'Extracting products with AI…' })
        .eq('id', job.id);

      result = await runExtraction({ content, mode, filename: file.name });
    } catch (extractErr: any) {
      console.error('[smart-import] extraction failed:', extractErr);
      await (client as any)
        .from('supplier_product_import_jobs')
        .update({
          status: 'failed',
          phase_message: null,
          error: extractErr?.message?.slice(0, 500) || 'Extraction failed',
        })
        .eq('id', job.id);
      return NextResponse.json({ jobId: job.id }, { status: 202 });
    }

    await (client as any)
      .from('supplier_product_import_jobs')
      .update({
        status: 'completed',
        phase_message: null,
        extracted_products: result,
      })
      .eq('id', job.id);

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error: any) {
    console.error('[smart-import] error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to start import' }, { status: 500 });
  }
}

/** Reads the uploaded file into the text payload Claude will see. */
async function readContent(
  source: 'pdf' | 'csv' | 'xlsx',
  buffer: Buffer,
): Promise<{ content: string; mode: ExtractionMode }> {
  if (source === 'pdf') {
    const parsed = await pdfParse(buffer);
    const text = parsed.text || '';
    return { content: text, mode: detectMode(text) };
  }

  if (source === 'csv') {
    const text = buffer.toString('utf8');
    return { content: text, mode: 'catalogue' };
  }

  // xlsx — convert the first sheet to TSV so Claude sees a tidy table.
  const xlsx = await import('xlsx');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { content: '', mode: 'catalogue' };
  const sheet = workbook.Sheets[sheetName];
  const tsv = xlsx.utils.sheet_to_csv(sheet, { FS: '\t' });
  return { content: tsv, mode: 'catalogue' };
}

async function runExtraction({
  content,
  mode,
  filename,
}: {
  content: string;
  mode: ExtractionMode;
  filename: string;
}): Promise<ExtractionResult> {
  if (!content.trim()) return { products: [], unmapped: [], mode_used: mode };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new AnthropicSDK({ apiKey });

  const params = buildExtractionRequest({ mode, content, filename });
  const response = await anthropic.messages.create(params);
  return parseExtractionResponse(response, mode);
}
