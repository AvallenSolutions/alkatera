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

  const rows = (pending ?? []) as Array<Omit<PendingBrand, 'product_count'>>;

  // Product counts per brand in one query.
  const ids = rows.map((r) => r.id);
  const productCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: products } = await supabase
      .from('product_directory')
      .select('brand_directory_id')
      .in('brand_directory_id', ids);
    for (const p of (products ?? []) as Array<{ brand_directory_id: string }>) {
      productCounts.set(p.brand_directory_id, (productCounts.get(p.brand_directory_id) ?? 0) + 1);
    }
  }
  const brands: PendingBrand[] = rows.map((r) => ({
    ...r,
    product_count: productCounts.get(r.id) ?? 0,
  }));

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

      <ReviewQueue initialBrands={brands} />

      {(count ?? 0) > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground text-center">
          Showing the oldest {PAGE_SIZE} of {(count ?? 0).toLocaleString()}. Clear these and
          refresh to load the next batch.
        </p>
      )}
    </div>
  );
}
