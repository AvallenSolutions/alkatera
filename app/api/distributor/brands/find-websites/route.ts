import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { findBrandWebsites, type BrandWebsiteInput } from '@/lib/distributor/website-finder';
import { queueBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';
import { mapWithConcurrency } from '@/lib/distributor/concurrent-map';

export const maxDuration = 60;

// Brands processed per request. Kept small so each call (one grounded-search
// wave) finishes well inside the function timeout — the bulk button loops with
// a cursor rather than processing all brands in a single long request, which
// is exactly what 504'd the original synchronous import.
const PAGE_SIZE = 16;

/**
 * POST /api/distributor/brands/find-websites
 * Body: { brand_profile_id?: string, after_id?: string, limit?: number }
 *
 * Finds official websites (Gemini grounded search) for brands in the caller's
 * org that don't have one yet, saves them, then queues a fresh scraping run for
 * the brands we located.
 *  - `brand_profile_id`: process that one brand (the per-brand button).
 *  - otherwise: process one page of website-less brands ordered by id, after
 *    `after_id`. The client loops, advancing the cursor, to backfill the whole
 *    portfolio without any single request running long. The cursor guarantees
 *    forward progress even for brands where no website is found.
 *
 * The brand-website source is the scraper's primary input, so a brand with no
 * website yields almost no data. This is the missing self-heal path: website
 * discovery otherwise only runs once, at SKU-import time.
 *
 * Owner / data_manager only. The response surfaces grounded-search errors and
 * raw model samples so a run that finds nothing tells you exactly why.
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { brand_profile_id?: unknown; after_id?: unknown; limit?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body = backfill from the start.
  }

  const singleBrandId =
    typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0
      ? body.brand_profile_id
      : null;
  const afterId = typeof body.after_id === 'string' ? body.after_id : '';
  const pageSize =
    typeof body.limit === 'number' && body.limit > 0 && body.limit <= PAGE_SIZE
      ? Math.floor(body.limit)
      : PAGE_SIZE;

  const orgId = auth.organization.id;
  let query = auth.supabase
    .from('brand_profiles')
    .select('id, name, country_of_origin')
    .eq('distributor_org_id', orgId)
    .eq('listing_status', 'active')
    .is('website', null)
    .order('id', { ascending: true });

  if (singleBrandId) {
    query = query.eq('id', singleBrandId);
  } else {
    if (afterId) query = query.gt('id', afterId);
    query = query.limit(pageSize);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  }

  const candidates = (rows ?? []) as Array<BrandWebsiteInput & { id: string }>;
  if (candidates.length === 0) {
    return NextResponse.json({
      attempted: 0,
      found: 0,
      queued: 0,
      errors: [],
      samples: [],
      nextCursor: null,
      hasMore: false,
      message: 'No brands without a website to look up.',
    });
  }

  const result = await findBrandWebsites(candidates);
  const updates = Array.from(result.found.entries());

  // Persist the discovered websites (scoped to this org, only where still null).
  let saved = 0;
  await mapWithConcurrency(updates, 8, async ([id, website]) => {
    const { error: updErr } = await auth.supabase
      .from('brand_profiles')
      .update({ website })
      .eq('id', id)
      .eq('distributor_org_id', orgId)
      .is('website', null);
    if (!updErr) saved += 1;
  });

  // Queue a fresh scrape for the brands we just gave a website to.
  let queued = 0;
  if (updates.length > 0) {
    try {
      const queueResult = await queueBrandsForScraping({
        supabase: auth.supabase,
        distributorOrgId: orgId,
        brandProfileIds: updates.map(([id]) => id),
        triggeredBy: 'manual',
        forceScrape: true,
      });
      queued = queueResult.queued;
    } catch {
      // Scraping is best-effort here; the cron also sweeps.
    }
  }

  // Cursor for the next page = the last (highest) id we just processed. A full
  // page means there may be more; a short page means we've reached the end.
  const nextCursor = singleBrandId ? null : candidates[candidates.length - 1].id;
  const hasMore = !singleBrandId && candidates.length === pageSize;

  return NextResponse.json({
    attempted: result.attempted,
    found: saved,
    queued,
    missingApiKey: result.missingApiKey,
    errors: result.errors,
    // Raw model samples — only meaningful for an admin debugging an empty run.
    samples: result.samples,
    nextCursor,
    hasMore,
  });
}
