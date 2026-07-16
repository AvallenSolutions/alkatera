import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import pdfParse from 'pdf-parse';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { rateLimit } from '@/lib/rate-limit';
import {
  buildExtractionRequest,
  detectMode,
  parseExtractionResponse,
  type ExtractionMode,
  type ExtractionResult,
} from '@/lib/extraction/supplier-product-extractor';
import { classifyDocument, shapeIngestResult } from '@/lib/ingest/classify-document';
import { buildIngestOrgContext } from '@/lib/ingest/org-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STORAGE_BUCKET = 'supplier-product-evidence';
const STAGING_BUCKET = 'ingest-staging';
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

    const rl = await rateLimit(`smart-import:${user.id}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment and try again.' }, { status: 429 });
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

    // Pillar 1 (data-revolution-plan.md): classify through the SAME shared
    // substrate as every other Smart Upload channel (channel='supplier_import'),
    // purely for the confidence signal + ingest_document_profiles learning.
    // The specialised catalogue extractor below stays the source of truth for
    // the actual product rows — this never blocks or fails the import; it
    // just resolves to the ingest_jobs id (or null) once done.
    const classifyPromise = classifyForLearning({ client, supplier, userId: user.id, file, buffer });

    // === Extract synchronously (v1) ============================================
    // The plan calls for a Netlify -background function in step 5; for now we
    // run extraction inline. PDFs typically parse + extract in <30s — within
    // the maxDuration cap on this route.
    let result: ExtractionResult | null = null;
    let extractError: string | null = null;
    try {
      const { content, mode } = await readContent(source, buffer);

      await (client as any)
        .from('supplier_product_import_jobs')
        .update({ status: 'extracting', phase_message: 'Extracting products with AI…' })
        .eq('id', job.id);

      result = await runExtraction({ content, mode, filename: file.name });
    } catch (err: any) {
      console.error('[smart-import] extraction failed:', err);
      extractError = err?.message?.slice(0, 500) || 'Extraction failed';
    }

    // Always wait for the classify pass before returning — once the response
    // is sent, the serverless function may freeze and never resume it.
    const ingestJobId = await classifyPromise;

    if (extractError || !result) {
      await (client as any)
        .from('supplier_product_import_jobs')
        .update({ status: 'failed', phase_message: null, error: extractError || 'Extraction failed' })
        .eq('id', job.id);
      return NextResponse.json({ jobId: job.id }, { status: 202 });
    }

    await (client as any)
      .from('supplier_product_import_jobs')
      .update({
        status: 'completed',
        phase_message: null,
        // _classification rides along in the same jsonb column (no schema
        // change) so the confirm route can find the ingest_jobs row to teach
        // via /api/ingest/feedback without exposing it to the client GET.
        extracted_products: ingestJobId ? { ...result, _classification: { ingestJobId } } : result,
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

/**
 * Best-effort classification pass through the shared Smart Upload substrate
 * (data-revolution-plan.md Pillar 1). Stashes a copy of the file to
 * ingest-staging (the supplier-product-evidence bucket keeps holding the
 * confirmed evidence copy, untouched), creates an ingest_jobs row tagged
 * channel='supplier_import', and runs it through the same Claude classifier
 * as every other channel.
 *
 * None of classify-document.ts's document types describe a multi-product
 * supplier catalogue, so this frequently comes back 'unsupported' or
 * misclassified for CSV/XLSX catalogues — that's fine and expected. The
 * point isn't the classifier's type guess, it's threading this upload
 * through the one ingest_jobs table + ingest_feedback loop everything else
 * uses, so admin views and the eval corpus see every intake channel. The
 * SPECIALISED catalogue extraction (buildExtractionRequest/runExtraction
 * above) remains the only thing that actually produces product rows.
 *
 * Never throws. Returns the ingest_jobs id on success, null on any failure
 * (including: no organisation on the supplier, storage/DB errors, or a
 * classifier error) — the caller always awaits this before responding, but
 * never lets a failure here affect the import itself.
 */
async function classifyForLearning({
  client,
  supplier,
  userId,
  file,
  buffer,
}: {
  client: any;
  supplier: { id: string; organization_id: string | null };
  userId: string;
  file: File;
  buffer: Buffer;
}): Promise<string | null> {
  if (!supplier.organization_id) return null;
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const stagingPath = `${supplier.organization_id}/${userId}/${Date.now()}-${safeName}`;

    const [{ error: stageErr }, orgContext] = await Promise.all([
      client.storage.from(STAGING_BUCKET).upload(stagingPath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      }),
      buildIngestOrgContext(client, supplier.organization_id).catch(() => null),
    ]);
    if (stageErr) {
      console.error('[smart-import] classify stage upload failed (non-fatal):', stageErr.message);
      return null;
    }

    const { data: ingestJob, error: insertErr } = await client
      .from('ingest_jobs')
      .insert({
        user_id: userId,
        organization_id: supplier.organization_id,
        status: 'pending',
        phase_message: 'Classifying…',
        stash_path: stagingPath,
        file_name: file.name,
        file_mime: file.type || null,
        channel: 'supplier_import',
      })
      .select('id')
      .single();
    if (insertErr || !ingestJob) {
      console.error('[smart-import] classify job insert failed (non-fatal):', insertErr);
      return null;
    }

    const classified = await classifyDocument({
      fileBytes: buffer,
      fileName: file.name,
      fileMime: file.type || '',
      orgContext: orgContext ?? undefined,
    });
    const shaped = shapeIngestResult(classified.type, classified.payload, stagingPath, classified.meta);
    await client
      .from('ingest_jobs')
      .update({
        status: 'completed',
        phase_message: null,
        result_type: shaped.result_type,
        result_payload: shaped.result_payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ingestJob.id);

    return ingestJob.id as string;
  } catch (err: any) {
    console.error('[smart-import] classify pass failed (non-fatal):', err?.message || err);
    return null;
  }
}
