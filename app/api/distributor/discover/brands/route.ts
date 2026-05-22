import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { logSearch } from '@/lib/admin/telemetry/log';

/**
 * GET /api/distributor/discover/brands
 *
 * Paginated search across the canonical brand_directory for brands the
 * caller's distributor can add to their portfolio. Filters mirror the
 * Discover page UI:
 *   - q              : free-text against name / aliases
 *   - category       : spirits | wine | beer | non_alc | other
 *   - country        : ISO-2 country code (matches country_of_origin)
 *   - tier           : leader | progressing | developing
 *   - alkatera_only  : true to restrict to alkatera-verified brands
 *   - has_lca        : true to restrict to brands with at least one
 *                      product_directory row carrying embodied_carbon_kgco2e
 *   - sort           : score | completeness | name | recent (default: score)
 *   - page           : 1-indexed
 *   - page_size      : default 24, max 100
 *
 * Returns `{ brands, total, page, page_size }`. Each brand includes a
 * `listed_by_you` boolean so the UI can render "Listed by you" badges
 * inline, plus product/listing counts for the search-result card.
 */
export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const category = url.searchParams.get('category');
  const country = url.searchParams.get('country');
  const tier = url.searchParams.get('tier');
  const alkateraOnly = url.searchParams.get('alkatera_only') === 'true';
  const hasLca = url.searchParams.get('has_lca') === 'true';
  const sort = (url.searchParams.get('sort') ?? 'score') as
    | 'score'
    | 'completeness'
    | 'name'
    | 'recent';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('page_size') ?? '24') || 24),
  );

  // 1. Build the directory query with discoverability gate.
  let query = auth.supabase
    .from('brand_directory')
    .select(
      'id, name, category, country_of_origin, alkatera_org_id, sustainability_score, score_tier, completeness_score, last_synced_at',
      { count: 'exact' },
    )
    .eq('discovery_opt_out', false);

  if (q) {
    // Trigram-friendly: use ILIKE on name. Free-text search across
    // aliases would need an or() or a dedicated RPC; for now ILIKE on
    // name handles the common "I know the name roughly" case.
    query = query.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`);
  }
  if (category) query = query.eq('category', category);
  if (country) query = query.eq('country_of_origin', country);
  if (tier) query = query.eq('score_tier', tier);
  if (alkateraOnly) query = query.not('alkatera_org_id', 'is', null);

  // Sorting. Tier null-safe so "leader" beats "no tier".
  if (sort === 'name') {
    query = query.order('name', { ascending: true });
  } else if (sort === 'completeness') {
    query = query.order('completeness_score', { ascending: false, nullsFirst: false });
  } else if (sort === 'recent') {
    query = query.order('last_synced_at', { ascending: false, nullsFirst: false });
  } else {
    query = query
      .order('sustainability_score', { ascending: false, nullsFirst: false })
      .order('completeness_score', { ascending: false, nullsFirst: false });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: brands, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const directoryIds = ((brands ?? []) as Array<{ id: string }>).map((b) => b.id);
  if (directoryIds.length === 0) {
    return NextResponse.json({
      brands: [],
      total: count ?? 0,
      page,
      page_size: pageSize,
    });
  }

  // 2. Enrichment in one round trip per axis:
  //    - listed_by_you: brand_profiles rows with this distributor + each directory id
  //    - has_lca: product_directory rows with non-null embodied_carbon_kgco2e
  //    - product_count: count of product_directory rows per brand
  const [{ data: listings }, { data: products }] = await Promise.all([
    auth.supabase
      .from('brand_profiles')
      .select('brand_directory_id')
      .eq('distributor_org_id', auth.organization.id)
      .in('brand_directory_id', directoryIds),
    auth.supabase
      .from('product_directory')
      .select('id, brand_directory_id, embodied_carbon_kgco2e')
      .in('brand_directory_id', directoryIds),
  ]);

  const listedByYou = new Set(
    ((listings ?? []) as Array<{ brand_directory_id: string }>).map(
      (l) => l.brand_directory_id,
    ),
  );
  const productCounts = new Map<string, number>();
  const lcaCounts = new Map<string, number>();
  for (const p of (products ?? []) as Array<{
    brand_directory_id: string;
    embodied_carbon_kgco2e: number | null;
  }>) {
    productCounts.set(p.brand_directory_id, (productCounts.get(p.brand_directory_id) ?? 0) + 1);
    if (p.embodied_carbon_kgco2e != null) {
      lcaCounts.set(p.brand_directory_id, (lcaCounts.get(p.brand_directory_id) ?? 0) + 1);
    }
  }

  type DirectoryRow = {
    id: string;
    name: string;
    category: string | null;
    country_of_origin: string | null;
    alkatera_org_id: string | null;
    sustainability_score: number | null;
    score_tier: string | null;
    completeness_score: number | null;
    last_synced_at: string | null;
  };

  let enriched = ((brands ?? []) as DirectoryRow[]).map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    country_of_origin: b.country_of_origin,
    on_alkatera: !!b.alkatera_org_id,
    sustainability_score: b.sustainability_score,
    score_tier: b.score_tier,
    completeness_score: b.completeness_score,
    last_synced_at: b.last_synced_at,
    listed_by_you: listedByYou.has(b.id),
    product_count: productCounts.get(b.id) ?? 0,
    lca_product_count: lcaCounts.get(b.id) ?? 0,
  }));

  // Apply has_lca filter here (post-query, since it depends on the
  // enrichment we just gathered). For accurate paging when has_lca is
  // set we'd need a SQL-level filter — punt this until Tim sees real
  // usage; the directory is small enough that page-local filtering is
  // fine for v1.
  if (hasLca) {
    enriched = enriched.filter((b) => b.lca_product_count > 0);
  }

  // Fire-and-forget telemetry. Only log meaningful queries (non-empty
  // query OR any filter active) so we don't pollute the table with the
  // default-state landing page hit. Log on page 1 only so paginating
  // through the same query doesn't multiply rows.
  const hasFilter =
    q.length > 0 ||
    !!category ||
    !!country ||
    !!tier ||
    alkateraOnly ||
    hasLca ||
    sort !== 'score';
  if (page === 1 && hasFilter) {
    void logSearch(auth.supabase, {
      distributorOrgId: auth.organization.id,
      userId: auth.user.id,
      query: q || null,
      filters: { category, country, tier, alkateraOnly, hasLca, sort },
      resultCount: enriched.length,
    });
  }

  return NextResponse.json({
    brands: enriched,
    total: count ?? enriched.length,
    page,
    page_size: pageSize,
  });
}
