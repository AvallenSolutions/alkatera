import type { SupabaseClient } from '@supabase/supabase-js';
import { Building2 } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { loadProcurementDashboard } from '@/lib/procurement/dashboard';
import { BrandList } from '@/components/procurement/dashboard/brand-list';
import { PageHeader } from '@/components/procurement/layout/page-header';

export const dynamic = 'force-dynamic';

/**
 * Full brand list for a procurement org — every brand listed by any
 * linked distributor with tier, score, volume and channels.
 */
export default async function ProcurementBrandsPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;

  const { data: org } = await supabase
    .from('procurement_organizations')
    .select('id, name, display_name')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!org) return null;
  const orgId = (org as { id: string }).id;

  const dashboard = await loadProcurementDashboard(supabase, orgId);

  const { data: bdRows } = await supabase
    .from('procurement_skus')
    .select(
      `brand_directory_id, source_distributor_org_id, channel_label, volume_per_year_liters,
       brand_directory:brand_directory_id (
         id, name, country_of_origin, category, sustainability_score,
         completeness_score, score_tier, alkatera_org_id
       )`,
    )
    .eq('procurement_org_id', orgId)
    .eq('listing_status', 'active');

  type Row = {
    brand_directory_id: string;
    source_distributor_org_id: string;
    channel_label: string;
    volume_per_year_liters: number | null;
    brand_directory:
      | {
          id: string;
          name: string;
          country_of_origin: string | null;
          category: string | null;
          sustainability_score: number | null;
          completeness_score: number | null;
          score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
          alkatera_org_id: string | null;
        }
      | {
          id: string;
          name: string;
          country_of_origin: string | null;
          category: string | null;
          sustainability_score: number | null;
          completeness_score: number | null;
          score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
          alkatera_org_id: string | null;
        }[]
      | null;
  };

  const distributorIds = Array.from(
    new Set(((bdRows ?? []) as Row[]).map((r) => r.source_distributor_org_id)),
  );
  const distributorNames = new Map<string, string>();
  if (distributorIds.length > 0) {
    const { data } = await supabase
      .from('distributor_organizations')
      .select('id, name')
      .in('id', distributorIds);
    for (const d of (data ?? []) as Array<{ id: string; name: string }>) {
      distributorNames.set(d.id, d.name);
    }
  }

  type Agg = {
    brand_directory_id: string;
    name: string;
    country_of_origin: string | null;
    category: string | null;
    sustainability_score: number | null;
    completeness_score: number | null;
    score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
    alkatera_org_id: string | null;
    sku_count: number;
    volume_liters: number;
    channels: Set<string>;
  };
  const byBrand = new Map<string, Agg>();
  for (const row of (bdRows ?? []) as Row[]) {
    const dir = Array.isArray(row.brand_directory) ? row.brand_directory[0] : row.brand_directory;
    if (!dir) continue;
    const entry =
      byBrand.get(row.brand_directory_id) ??
      ({
        brand_directory_id: row.brand_directory_id,
        name: dir.name,
        country_of_origin: dir.country_of_origin,
        category: dir.category,
        sustainability_score: dir.sustainability_score,
        completeness_score: dir.completeness_score,
        score_tier: dir.score_tier,
        alkatera_org_id: dir.alkatera_org_id,
        sku_count: 0,
        volume_liters: 0,
        channels: new Set<string>(),
      } as Agg);
    entry.sku_count += 1;
    entry.volume_liters += row.volume_per_year_liters ?? 0;
    entry.channels.add(distributorNames.get(row.source_distributor_org_id) ?? row.channel_label);
    byBrand.set(row.brand_directory_id, entry);
  }

  const brands = Array.from(byBrand.values())
    .map((b) => ({
      brand_directory_id: b.brand_directory_id,
      name: b.name,
      country_of_origin: b.country_of_origin,
      category: b.category,
      sustainability_score: b.sustainability_score,
      completeness_score: b.completeness_score,
      score_tier: b.score_tier,
      alkatera_org_id: b.alkatera_org_id,
      sku_count: b.sku_count,
      volume_liters: b.volume_liters,
      channels: Array.from(b.channels),
    }))
    .sort((a, b) => (b.sustainability_score ?? 0) - (a.sustainability_score ?? 0));

  return (
    <div className="space-y-8">
      <PageHeader
        pill="Brands"
        pillIcon={Building2}
        title={
          brands.length === 0
            ? 'Brands in portfolio'
            : `${brands.length} ${brands.length === 1 ? 'brand' : 'brands'} in portfolio`
        }
        subtitle={`Every brand a linked distributor sources for your ${dashboard.totals.sku_count} active SKUs. Click any row to see procurement-specific data and the sustainability findings on file.`}
      />

      <BrandList
        brands={brands}
        slug={params.slug}
        emptyText="No brands yet. Upload a SKU list to populate this view."
      />
    </div>
  );
}
