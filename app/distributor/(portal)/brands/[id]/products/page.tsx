import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Package, ChevronRight, Inbox } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

/**
 * Products tab for the brand detail page. Lists every SKU under the
 * brand with its metadata, a count of SKU-specific findings, and a
 * click-through to the per-SKU detail page.
 */
export default async function BrandProductsTabPage({ params }: PageProps) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!brand) return null;
  const directoryId = (brand as { brand_directory_id: string }).brand_directory_id;

  const { data: skus } = await supabase
    .from('brand_skus')
    .select('id, sku_code, product_name, category, country_of_origin, listing_status, updated_at')
    .eq('brand_profile_id', brand.id)
    .order('product_name');
  type SkuRow = {
    id: string;
    sku_code: string | null;
    product_name: string;
    category: string | null;
    country_of_origin: string | null;
    listing_status: 'active' | 'delisted';
    updated_at: string;
  };
  const skuRows = (skus ?? []) as SkuRow[];

  // Count SKU-specific findings per SKU so the products list shows how
  // much data we have per product. We exclude superseded rows so the
  // count reflects the current state.
  let findingsBySku = new Map<string, number>();
  let documentsBySku = new Map<string, number>();
  if (skuRows.length > 0) {
    const skuIds = skuRows.map((s) => s.id);
    const [{ data: findingRows }, { data: docRows }] = await Promise.all([
      supabase
        .from('scraped_brand_data')
        .select('brand_sku_id')
        .in('brand_sku_id', skuIds)
        .is('superseded_by', null),
      // Documents tagged with this SKU via brand_sku_ids array.
      supabase
        .from('brand_document_submissions')
        .select('brand_sku_ids')
        .eq('brand_directory_id', directoryId)
        .not('brand_sku_ids', 'is', null),
    ]);
    for (const row of (findingRows ?? []) as Array<{ brand_sku_id: string }>) {
      findingsBySku.set(row.brand_sku_id, (findingsBySku.get(row.brand_sku_id) ?? 0) + 1);
    }
    for (const row of (docRows ?? []) as Array<{ brand_sku_ids: string[] | null }>) {
      if (!Array.isArray(row.brand_sku_ids)) continue;
      for (const id of row.brand_sku_ids) {
        if (skuIds.includes(id)) {
          documentsBySku.set(id, (documentsBySku.get(id) ?? 0) + 1);
        }
      }
    }
  }

  if (skuRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-12 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Inbox className="h-5 w-5" />
        No SKUs imported for this brand yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 px-2.5 py-1 text-sky-300">
          <Package className="h-3 w-3" />
          {skuRows.length} product{skuRows.length === 1 ? '' : 's'}
        </span>
        <span className="normal-case tracking-normal text-muted-foreground">
          Click any product to drill into its data.
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <tr className="border-b border-border/60 bg-background/30">
              <th className="text-left px-4 py-3.5">Product</th>
              <th className="text-left px-4 py-3.5">SKU code</th>
              <th className="text-left px-4 py-3.5">Category</th>
              <th className="text-left px-4 py-3.5">Country</th>
              <th className="text-left px-4 py-3.5">Status</th>
              <th className="text-left px-4 py-3.5">Specific data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {skuRows.map((sku) => {
              const findings = findingsBySku.get(sku.id) ?? 0;
              const docs = documentsBySku.get(sku.id) ?? 0;
              return (
                <tr
                  key={sku.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-sky-500/5 transition-colors group"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/distributor/brands/${params.id}/skus/${sku.id}`}
                      className="font-medium inline-flex items-center gap-2 text-foreground group-hover:text-sky-200 transition-colors"
                    >
                      <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1">
                        <Package className="h-3 w-3 text-sky-300" />
                      </div>
                      {sku.product_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                    {sku.sku_code ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{sku.category ?? '—'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {sku.country_of_origin ?? '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant="outline"
                      className={
                        sku.listing_status === 'active'
                          ? 'text-[10px] uppercase tracking-wider font-semibold text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-muted'
                      }
                    >
                      {sku.listing_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    {findings > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                        <span className="text-emerald-300 font-medium">
                          {findings} finding{findings === 1 ? '' : 's'}
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="text-muted-foreground italic">brand-level only</span>
                      </span>
                    )}
                    {docs > 0 && (
                      <span className="text-muted-foreground block mt-1 pl-3">
                        · {docs} doc{docs === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:text-sky-300 transition" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Findings shown here are <strong className="text-foreground">specific to a product</strong>{' '}
        (e.g. a vintage's carbon footprint). Brand-level findings that apply to every SKU appear on
        the Data tab and on each product's detail page.
      </p>
    </div>
  );
}
