import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';
import { resolveOrCreateProductEntry } from '@/lib/distributor/directory/product-matcher';
import { ingestDiscoveredPdf } from '@/lib/distributor/scraping/pdf-ingester';

/**
 * POST /api/admin/directory/brands/[id]/deep-enrich
 *
 * Runs a single-brand Claude + web_search pass to find products and
 * sustainability documents (EPDs, LCAs, sustainability reports). Used
 * when the brand-website crawler missed things (JS-heavy sites, hidden
 * Shopify catalogues, docs hosted on third-party platforms).
 *
 * Persistence reuses the existing pipelines:
 *   - products → resolveOrCreateProductEntry (matcher dedupes by GTIN
 *     / normalised name)
 *   - documents → ingestDiscoveredPdf for URLs ending in .pdf
 *     (downloads + queues for the document processor)
 *   - non-PDF document URLs are returned to the client but skipped at
 *     ingest — admin sees them in the result panel and can upload
 *     manually
 *
 * Cost note: ~6 web_search calls + a single Sonnet completion per
 * invocation. Don't surface this as a one-click-per-row bulk action.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: brand } = await auth.service
    .from('brand_directory')
    .select('id, name, website, country_of_origin, category')
    .eq('id', params.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const directory = brand as {
    id: string;
    name: string;
    website: string | null;
    country_of_origin: string | null;
    category: string | null;
  };

  const enriched = await deepEnrichBrand({
    brandName: directory.name,
    website: directory.website,
    country: directory.country_of_origin,
    category: directory.category,
  });
  if (enriched.error && enriched.products.length === 0 && enriched.documents.length === 0) {
    return NextResponse.json(
      { error: 'enrich_failed', detail: enriched.error },
      { status: 502 },
    );
  }

  let productsCreated = 0;
  let productsLinked = 0;
  const productErrors: string[] = [];
  const productSeen = new Set<string>();
  for (const p of enriched.products) {
    const key = p.name.trim().toLowerCase();
    if (!key || productSeen.has(key)) continue;
    productSeen.add(key);
    try {
      const result = await resolveOrCreateProductEntry(auth.service, {
        brandDirectoryId: directory.id,
        displayName: p.name,
        category: p.category ?? null,
        discoveredVia: 'manual',
      });
      if (result.created) productsCreated += 1;
      else productsLinked += 1;
    } catch (err: unknown) {
      productErrors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let docsIngested = 0;
  let docsSkipped = 0;
  const docDetails: Array<{ url: string; status: string; reason?: string }> = [];
  for (const doc of enriched.documents) {
    // Only auto-ingest URLs that look like direct PDFs. Non-PDF URLs
    // (article pages, landing pages, third-party indexes) get echoed
    // back so the admin can decide what to do with them.
    if (!/\.pdf(\?|#|$)/i.test(doc.url)) {
      docsSkipped += 1;
      docDetails.push({ url: doc.url, status: 'skipped', reason: 'not_a_pdf' });
      continue;
    }
    try {
      const result = await ingestDiscoveredPdf({
        supabase: auth.service,
        brandDirectoryId: directory.id,
        distributorOrgId: null,
        document: doc,
      });
      if (result.ingested) {
        docsIngested += 1;
        docDetails.push({ url: doc.url, status: 'ingested' });
      } else {
        docsSkipped += 1;
        docDetails.push({
          url: doc.url,
          status: 'skipped',
          reason: result.skipped_reason ?? result.error ?? 'unknown',
        });
      }
    } catch (err: unknown) {
      docsSkipped += 1;
      docDetails.push({
        url: doc.url,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: enriched.summary ?? null,
    products: {
      created: productsCreated,
      linked: productsLinked,
      errors: productErrors,
    },
    documents: {
      ingested: docsIngested,
      skipped: docsSkipped,
      details: docDetails,
    },
    enrich_error: enriched.error ?? null,
  });
}
