import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDistributor } from '@/lib/distributor/auth';
import type { ColumnMapping } from '@/types/distributor';

/**
 * POST /api/distributor/sku-lists/[id]/confirm
 * Body: { column_mapping: ColumnMapping }
 *
 * Persists the chosen mapping, flips the row to status='processing', and hands
 * the heavy work (download + parse + brand/SKU persistence + scraping queue) to
 * the process-sku-import-background Netlify function. Returns 202 immediately;
 * the upload wizard polls GET /api/distributor/sku-lists/[id] for the result.
 *
 * Real distributor catalogues run ~1-2k serial Supabase round-trips, which
 * exceeded Netlify's synchronous function limit and 504'd. The 15-min
 * background function removes that ceiling.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { column_mapping?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mapping = validateMapping(body.column_mapping);
  if (!mapping) {
    return NextResponse.json(
      { error: 'invalid_mapping', detail: 'brand_name and product_name are required' },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await auth.supabase
    .from('distributor_sku_lists')
    .select('id')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
  if (!hmacSecret) {
    console.error('[sku-import] INTERNAL_JOB_HMAC_SECRET not set');
    return NextResponse.json({ error: 'import_not_configured' }, { status: 500 });
  }

  // Reset the row for a fresh run: mapping persisted, status=processing,
  // any prior result/error cleared so the poller sees a clean state.
  await auth.supabase
    .from('distributor_sku_lists')
    .update({
      status: 'processing',
      column_mapping: mapping,
      import_result: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  const payload = JSON.stringify({
    skuListId: params.id,
    distributorOrgId: auth.organization.id,
    mapping,
  });
  const signature = createHmac('sha256', hmacSecret).update(payload).digest('hex');

  // Local dev (`pnpm dev`) doesn't run Netlify functions, so a fetch to
  // /.netlify/functions/... would 404 and the row would sit at 'processing'
  // forever. Invoke the handler in-process instead — Next dev has no 26s
  // synchronous cap, so the long run is fine. Fire-and-forget either way;
  // the client polls for completion.
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.NETLIFY;
  if (isDev) {
    void (async () => {
      try {
        const { handler } = await import('@/netlify/functions/process-sku-import-background');
        await handler({ body: payload, headers: { 'x-internal-hmac': signature } });
      } catch (err) {
        console.error('[sku-import] Inline runner failed:', err);
        await markError(
          auth.supabase as unknown as SupabaseClient,
          params.id,
          err instanceof Error ? err.message : 'inline_runner_failed',
        );
      }
    })();
  } else {
    const baseUrl =
      process.env.URL || process.env.DEPLOY_URL || `https://${request.headers.get('host')}`;
    const target = `${baseUrl}/.netlify/functions/process-sku-import-background`;
    void fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
      body: payload,
    }).catch((err) => {
      console.error('[sku-import] Failed to trigger background function:', err);
    });
  }

  return NextResponse.json({ status: 'processing', sku_list_id: params.id }, { status: 202 });
}

function validateMapping(input: unknown): ColumnMapping | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.product_name !== 'string' || !obj.product_name) return null;
  const aiBrand = obj.brand_source === 'ai';
  // brand_name is required unless we're detecting brands from product names.
  if (!aiBrand && (typeof obj.brand_name !== 'string' || !obj.brand_name)) return null;
  const mapping: ColumnMapping = {
    product_name: obj.product_name,
    brand_source: aiBrand ? 'ai' : 'column',
  };
  if (typeof obj.brand_name === 'string' && obj.brand_name) {
    mapping.brand_name = obj.brand_name;
  }
  for (const field of [
    'sku_code',
    'gtin',
    'category',
    'country_of_origin',
    'listing_status',
    'website',
  ] as const) {
    if (typeof obj[field] === 'string' && obj[field]) {
      mapping[field] = obj[field] as string;
    }
  }
  return mapping;
}

async function markError(supabase: SupabaseClient, id: string, message: string) {
  await supabase
    .from('distributor_sku_lists')
    .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', id);
}
