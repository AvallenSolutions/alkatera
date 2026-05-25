import type { SupabaseClient } from '@supabase/supabase-js';
import { ShieldCheck } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { ReviewQueue, type PendingBrand } from '@/components/admin/directory/review-queue';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

export default async function AdminReviewPage() {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: pending, count } = await supabase
    .from('brand_directory')
    .select(
      'id, name, category, country_of_origin, website, discovered_via, completeness_score, created_at',
      { count: 'exact' },
    )
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(PAGE_SIZE);

  const rows = (pending ?? []) as Array<
    Omit<PendingBrand, 'product_count' | 'scraped_field_count' | 'scrape_status'>
  >;
  const ids = rows.map((r) => r.id);

  // Pull product counts, scraped-field counts, and the latest admin-intake
  // scrape status per directory entry — all in parallel.
  const [productCounts, fieldCounts, scrapeStatuses, intakeStats] = await Promise.all([
    queryProductCounts(supabase, ids),
    queryScrapedFieldCounts(supabase, ids),
    queryLatestScrapeStatus(supabase, ids),
    queryIntakeStats(supabase),
  ]);

  const brands: PendingBrand[] = rows.map((r) => ({
    ...r,
    product_count: productCounts.get(r.id) ?? 0,
    scraped_field_count: fieldCounts.get(r.id) ?? 0,
    scrape_status: scrapeStatuses.get(r.id) ?? null,
  }));

  // Sort highest-info first so the reviewer hits the most-actionable
  // brands at the top. Tie-break by creation date ascending so an older
  // pending brand with equal richness still surfaces sooner.
  brands.sort((a, b) => {
    const ra = richnessScore(a);
    const rb = richnessScore(b);
    if (ra !== rb) return rb - ra;
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-lime/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-neon-lime/15 border border-neon-lime/30 p-3 shrink-0">
            <ShieldCheck className="h-6 w-6 text-neon-lime" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]" />
              Review queue
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Verify brands before they go live
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {(count ?? 0).toLocaleString()} brand{(count ?? 0) === 1 ? '' : 's'} awaiting review.
              Verifying a brand makes it (and its products) discoverable to distributors. alka
              <strong>tera</strong> brands are auto-verified and never appear here.
            </p>
          </div>
        </div>
      </div>

      <IntakeStatsRow stats={intakeStats} pendingCount={count ?? 0} />

      <ReviewQueue initialBrands={brands} />

      {(count ?? 0) > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground text-center">
          Showing the {PAGE_SIZE} richest of {(count ?? 0).toLocaleString()}. Clear these and
          refresh to load the next batch.
        </p>
      )}
    </div>
  );
}

function richnessScore(b: PendingBrand): number {
  // Bigger = surface earlier. Successful brand-website scrape is the
  // strongest signal (the site definitely exists + we read it). A bare
  // website on the row is worth less than scraped fields. Pending /
  // queued scrapes sit in the middle — they'll soon be rich.
  let score = 0;
  if (b.scrape_status === 'complete') score += 50;
  if (b.scrape_status === 'queued' || b.scrape_status === 'running') score += 15;
  if (b.scrape_status === 'error') score -= 5;
  if (b.website) score += 5;
  score += Math.min(20, b.scraped_field_count) * 2;
  score += Math.min(10, b.product_count);
  if (b.country_of_origin) score += 1;
  if (b.category) score += 1;
  if (b.completeness_score) score += Math.min(20, b.completeness_score / 5);
  return score;
}

async function queryProductCounts(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from('product_directory')
    .select('brand_directory_id')
    .in('brand_directory_id', ids);
  for (const p of (data ?? []) as Array<{ brand_directory_id: string }>) {
    out.set(p.brand_directory_id, (out.get(p.brand_directory_id) ?? 0) + 1);
  }
  return out;
}

async function queryScrapedFieldCounts(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from('scraped_brand_data')
    .select('brand_directory_id')
    .in('brand_directory_id', ids)
    .is('superseded_by', null);
  for (const r of (data ?? []) as Array<{ brand_directory_id: string }>) {
    out.set(r.brand_directory_id, (out.get(r.brand_directory_id) ?? 0) + 1);
  }
  return out;
}

async function queryLatestScrapeStatus(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, PendingBrand['scrape_status']>> {
  const out = new Map<string, PendingBrand['scrape_status']>();
  if (ids.length === 0) return out;
  // For each directory entry, take the newest admin-intake job. A small
  // N here (≤100) means we can fetch all rows and bucket in JS.
  const { data } = await supabase
    .from('scraping_jobs')
    .select('brand_directory_id, status, created_at')
    .in('brand_directory_id', ids)
    .eq('triggered_by', 'admin_intake')
    .order('created_at', { ascending: false });
  for (const row of (data ?? []) as Array<{
    brand_directory_id: string;
    status: PendingBrand['scrape_status'];
  }>) {
    if (!out.has(row.brand_directory_id)) {
      out.set(row.brand_directory_id, row.status);
    }
  }
  return out;
}

async function queryIntakeStats(supabase: SupabaseClient): Promise<{
  awaiting_scrape: number;
  scraping_now: number;
  scrape_complete_pending_review: number;
}> {
  const [{ count: queued }, { count: running }, { count: complete }] = await Promise.all([
    supabase
      .from('scraping_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('triggered_by', 'admin_intake')
      .eq('status', 'queued'),
    supabase
      .from('scraping_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('triggered_by', 'admin_intake')
      .eq('status', 'running'),
    supabase
      .from('scraping_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('triggered_by', 'admin_intake')
      .eq('status', 'complete'),
  ]);
  return {
    awaiting_scrape: queued ?? 0,
    scraping_now: running ?? 0,
    scrape_complete_pending_review: complete ?? 0,
  };
}

function IntakeStatsRow({
  stats,
  pendingCount,
}: {
  stats: {
    awaiting_scrape: number;
    scraping_now: number;
    scrape_complete_pending_review: number;
  };
  pendingCount: number;
}) {
  const tiles = [
    { label: 'Pending review', value: pendingCount },
    { label: 'Queued for first scrape', value: stats.awaiting_scrape },
    { label: 'Scraping now', value: stats.scraping_now },
    { label: 'Scrape complete', value: stats.scrape_complete_pending_review },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-border/60 bg-card/40 px-4 py-3"
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t.label}
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {t.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
