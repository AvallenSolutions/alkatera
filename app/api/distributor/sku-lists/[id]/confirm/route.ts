import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireDistributor } from '@/lib/distributor/auth';
import { inngest } from '@/lib/inngest/client';
import type { ColumnMapping } from '@/types/distributor';

/**
 * POST /api/distributor/sku-lists/[id]/confirm
 * Body: { column_mapping: ColumnMapping }
 *
 * Persists the chosen mapping, flips the row to status='processing', and hands
 * the heavy work (download + parse + brand/SKU persistence + scraping queue) to
 * the `distributor/sku-import.run` Inngest function
 * (lib/inngest/functions/distributor-jobs.ts). Returns 202 immediately; the
 * upload wizard polls GET /api/distributor/sku-lists/[id] for the result.
 *
 * Real distributor catalogues run ~1-2k serial Supabase round-trips, which
 * exceeded Netlify's synchronous function limit and 504'd. Inngest removes
 * that ceiling with no platform-specific dispatch.
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

  // Fire-and-forget: the client polls for completion either way. Runs
  // identically in local dev (via the Inngest dev server) and production —
  // no Netlify-only background-function URL to construct.
  inngest
    .send({
      name: 'distributor/sku-import.run',
      data: { sku_list_id: params.id, distributor_org_id: auth.organization.id, mapping },
    })
    .catch(async (err) => {
      console.error('[sku-import] inngest.send failed:', err);
      await markError(
        auth.supabase as unknown as SupabaseClient,
        params.id,
        err instanceof Error ? err.message : 'dispatch_failed',
      );
    });

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
