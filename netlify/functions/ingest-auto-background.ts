import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { classifyDocument } from '@/lib/ingest/classify-document';

/**
 * Background runner for Smart Upload (the "Upload anything" dropzone and
 * facility bill dialogs). Netlify's -background suffix gives us 15 min, which
 * removes the 26s sync cap that was making historical sustainability/LCA
 * report uploads "completely fail" on bigger PDFs.
 *
 * The Next route at /api/ingest/auto stashes the file in ingest-staging and
 * inserts an ingest_jobs row, then fires an HMAC-signed request here. We
 * download the stashed file, run the classifier, and write the result back
 * to the row. The client polls /api/ingest/auto/[jobId] for completion.
 */

function verifyHmac(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Map the classifier's discriminated `{ type, payload }` to the wire shape
// the existing client (UniversalDropzone, UtilityBillImportDialog, etc.)
// already understands — same field names as IngestResponse.
function shapeResponse(
  type: string,
  payload: Record<string, unknown>,
  stashId: string,
): { result_type: string; result_payload: Record<string, unknown> } {
  switch (type) {
    case 'utility_bill':
      return { result_type: type, result_payload: { type, utilityBill: payload } };
    case 'water_bill':
      return { result_type: type, result_payload: { type, waterBill: payload } };
    case 'waste_bill':
      return { result_type: type, result_payload: { type, wasteBill: payload } };
    case 'bulk_xlsx':
      return { result_type: type, result_payload: { type, xlsx: payload } };
    case 'spray_diary':
      return {
        result_type: type,
        result_payload: { type, sprayDiary: { ...payload, stashId } },
      };
    case 'bom':
      return {
        result_type: type,
        result_payload: { type, bom: { ...payload, stashId } },
      };
    case 'soil_carbon_evidence':
      return {
        result_type: type,
        result_payload: { type, soilCarbonEvidence: { ...payload, stashId } },
      };
    case 'accounts_csv':
      return { result_type: type, result_payload: { type, accountsCsv: payload } };
    case 'historical_sustainability_report':
      return {
        result_type: type,
        result_payload: {
          type,
          historicalSustainabilityReport: { ...payload, stashId },
        },
      };
    case 'historical_lca_report':
      return {
        result_type: type,
        result_payload: {
          type,
          historicalLcaReport: { ...payload, stashId },
        },
      };
    case 'unsupported':
    default:
      return {
        result_type: 'unsupported',
        result_payload: { type: 'unsupported', reason: (payload as any)?.reason },
      };
  }
}

export const handler = async (event: { body?: string | null; headers: Record<string, string | undefined> }) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!secret || !supabaseUrl || !serviceKey || !anthropicKey) {
    console.error('[ingest-auto-background] Missing required env vars');
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sigHeader = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sigHeader, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { jobId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { jobId } = payload;
  if (!jobId) return { statusCode: 400, body: 'missing jobId' };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updateJob = async (patch: Record<string, any>) => {
    await supabase
      .from('ingest_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    const { data: job, error: jobErr } = await supabase
      .from('ingest_jobs')
      .select('id, stash_path, file_name, file_mime')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      console.error('[ingest-auto-background] Job not found:', jobErr?.message);
      return { statusCode: 404, body: 'job not found' };
    }

    await updateJob({ status: 'extracting', phase_message: 'Reading the document…' });

    const { data: download, error: dlErr } = await supabase.storage
      .from('ingest-staging')
      .download(job.stash_path);
    if (dlErr || !download) {
      await updateJob({
        status: 'failed',
        error: 'Could not read the uploaded file from staging storage.',
      });
      return { statusCode: 200, body: 'ok' };
    }

    const fileBytes = new Uint8Array(await download.arrayBuffer());

    await updateJob({ phase_message: 'Identifying the document with AI…' });

    const result = await classifyDocument({
      fileBytes,
      fileName: job.file_name,
      fileMime: job.file_mime || '',
    });

    const shaped = shapeResponse(result.type, result.payload, job.stash_path);

    await updateJob({
      status: 'completed',
      phase_message: null,
      result_type: shaped.result_type,
      result_payload: shaped.result_payload,
    });

    return { statusCode: 200, body: 'ok' };
  } catch (error: any) {
    console.error('[ingest-auto-background] Error:', error);
    await updateJob({
      status: 'failed',
      error: error?.message?.slice(0, 500) || 'Failed to classify document',
    });
    return { statusCode: 200, body: 'ok' };
  }
};
