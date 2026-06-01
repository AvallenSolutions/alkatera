import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { runSkuImport } from '../../lib/distributor/run-sku-import';
import type { ColumnMapping } from '../../types/distributor';

/**
 * Background Netlify Function for the distributor SKU-list import.
 *
 * The -background suffix gives this up to 15 minutes of runtime. The
 * synchronous confirm route was running ~1-2k serial Supabase round-trips
 * (one real distributor catalogue = 481 rows / 132 brands) inside a single
 * request and 504'ing against Netlify's function time limit.
 *
 * The Next.js POST route at /api/distributor/sku-lists/[id]/confirm sets the
 * row to status='processing' and fires an HMAC-signed request here. We do the
 * download + parse + brand/SKU persistence + scraping queue and write the
 * result back onto distributor_sku_lists (status='complete' + import_result,
 * or status='error' + error_message). The upload wizard polls the row.
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

export const handler = async (event: {
  body?: string | null;
  headers: Record<string, string | undefined>;
}) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('[process-sku-import-background] Missing required env vars');
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sigHeader = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sigHeader, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { skuListId?: string; distributorOrgId?: string; mapping?: ColumnMapping };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { skuListId, distributorOrgId, mapping } = payload;
  if (!skuListId || !distributorOrgId || !mapping) {
    return { statusCode: 400, body: 'missing fields' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await runSkuImport({ supabase, skuListId, distributorOrgId, mapping });
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    // runSkuImport already stamped status='error' on the row for the
    // failure modes it owns; this catch is the backstop for anything else.
    const message = err instanceof Error ? err.message : 'import_failed';
    console.error('[process-sku-import-background] import failed:', message);
    await supabase
      .from('distributor_sku_lists')
      .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', skuListId);
    return { statusCode: 200, body: 'handled-error' };
  }
};
