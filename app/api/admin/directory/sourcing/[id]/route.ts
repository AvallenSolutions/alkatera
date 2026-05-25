import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { processBulkBrands } from '@/lib/admin/directory/process-bulk-brands';
import { processBulkProducts } from '@/lib/admin/directory/process-bulk-products';
import {
  BRAND_FIELDS,
  PRODUCT_FIELDS,
  type BrandFieldKey,
  type ProductFieldKey,
} from '@/lib/admin/directory/field-specs';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/directory/sourcing/[id]
 *
 * Poll endpoint for an async sourcing job. Returns the job's status.
 * When the background search has finished (status='searched'), this
 * route performs the ingest itself — reusing the bulk processors,
 * which depend on the `@/` alias and so can't run inside the Netlify
 * function. The searched→ingesting transition is atomic so concurrent
 * polls don't double-ingest.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: jobRow } = await auth.service
    .from('brand_sourcing_jobs')
    .select('id, status, phase_message, found, result, error, progress, target_count')
    .eq('id', params.id)
    .maybeSingle();
  if (!jobRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const job = jobRow as {
    id: string;
    status: string;
    phase_message: string | null;
    found: { brands?: unknown; products?: unknown; summary?: string | null } | null;
    result: unknown;
    error: string | null;
    progress: Record<string, unknown> | null;
    target_count: number | null;
  };

  // Finalise: once the web search is done, ingest as pending. Claim the
  // job atomically so only one poll runs the ingest.
  if (job.status === 'searched') {
    const { data: claimed } = await auth.service
      .from('brand_sourcing_jobs')
      .update({ status: 'ingesting', phase_message: 'Adding to the directory…' })
      .eq('id', job.id)
      .eq('status', 'searched')
      .select('id');
    if (Array.isArray(claimed) && claimed.length === 1) {
      const result = await ingest(auth.service, job.found);
      await auth.service
        .from('brand_sourcing_jobs')
        .update({
          status: 'done',
          phase_message: null,
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return NextResponse.json({ status: 'done', result, progress: job.progress });
    }
    // Another poll claimed it — fall through and report current state.
  }

  return NextResponse.json({
    status: job.status,
    phase_message: job.phase_message,
    result: job.result,
    error: job.error,
    progress: job.progress,
    target_count: job.target_count,
  });
}

async function ingest(
  service: SupabaseClient,
  found: { brands?: unknown; products?: unknown; summary?: string | null } | null,
): Promise<Record<string, unknown>> {
  const brands = Array.isArray(found?.brands) ? (found!.brands as object[]) : [];
  const products = Array.isArray(found?.products) ? (found!.products as object[]) : [];

  const brandMapping = identityMapping(BRAND_FIELDS.map((f) => f.key)) as Partial<
    Record<BrandFieldKey, string>
  >;
  const productMapping = identityMapping(PRODUCT_FIELDS.map((f) => f.key)) as Partial<
    Record<ProductFieldKey, string>
  >;

  const brandResult =
    brands.length > 0
      ? await processBulkBrands({
          service,
          rows: brands.map(stringifyValues),
          mapping: brandMapping,
        })
      : {
          rows_processed: 0,
          brands_created: 0,
          brands_linked: 0,
          brands_alkatera_linked: 0,
          errors: [],
          created_directory_ids: [] as string[],
          scrape_enqueue: { queued: 0, skipped_no_website: 0, skipped_already_queued: 0 },
        };

  const productResult =
    products.length > 0
      ? await processBulkProducts({
          service,
          rows: products.map(stringifyValues),
          mapping: productMapping,
        })
      : { rows_processed: 0, products_created: 0, products_linked: 0, errors: [] };

  return {
    summary: found?.summary ?? null,
    found_brands: brands.length,
    brand_names: brands
      .map((b) => (b as { name?: unknown }).name)
      .filter((n): n is string => typeof n === 'string'),
    brands: {
      created: brandResult.brands_created,
      linked: brandResult.brands_linked,
      alkatera_linked: brandResult.brands_alkatera_linked,
      errors: brandResult.errors,
    },
    products: {
      created: productResult.products_created,
      linked: productResult.products_linked,
      errors: productResult.errors,
    },
    scrape_enqueue: brandResult.scrape_enqueue,
  };
}

function identityMapping(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = k;
  return out;
}

function stringifyValues(row: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}
