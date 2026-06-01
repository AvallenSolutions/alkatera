import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * All the aggregations a procurement dashboard needs in one round of
 * queries against the per-procurement scope. Every shape is presentation-
 * ready so the widget components stay purely presentational and the
 * dashboard page stays simple.
 *
 * Scope rules:
 *   * procurement_skus = listing scope (procurement_org_id + active)
 *   * brand_directory  = canonical sustainability data per brand
 *   * brand_completeness_snapshots = latest scores per brand
 *   * source_distributor_org_id → distributor_organizations.name = channel label
 */

export interface ChannelBreakdown {
  channel: string;
  distributor_org_id: string;
  sku_count: number;
  volume_liters: number;
  brand_count: number;
}

export interface CategoryBreakdown {
  category: string;
  sku_count: number;
}

export interface CountryBreakdown {
  country: string;
  sku_count: number;
  brand_count: number;
}

export interface TierDistribution {
  tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | 'unknown';
  brand_count: number;
  sku_count: number;
}

export interface CompletenessBand {
  label: string;
  count: number;
}

export interface BrandSummary {
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
  channels: string[];
}

export interface DashboardData {
  totals: {
    sku_count: number;
    brand_count: number;
    channel_count: number;
    coverage_pct: number;
    leader_count: number;
  };
  channels: ChannelBreakdown[];
  categories: CategoryBreakdown[];
  countries: CountryBreakdown[];
  tiers: TierDistribution[];
  completeness_bands: CompletenessBand[];
  top_wins: BrandSummary[];
  top_gaps: BrandSummary[];
}

interface ProcurementSkuRow {
  id: string;
  brand_directory_id: string;
  source_distributor_org_id: string;
  category: string | null;
  country_of_origin: string | null;
  volume_per_year_liters: number | null;
  channel_label: string;
}

interface DirectoryRow {
  id: string;
  name: string;
  country_of_origin: string | null;
  category: string | null;
  sustainability_score: number | null;
  completeness_score: number | null;
  score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  alkatera_org_id: string | null;
}

const TIER_ORDER: TierDistribution['tier'][] = [
  'leader',
  'progressing',
  'developing',
  'insufficient',
  'unknown',
];

const COMPLETENESS_BAND_DEFS: Array<{ label: string; min: number; max: number }> = [
  { label: '0–25', min: 0, max: 25 },
  { label: '25–50', min: 25, max: 50 },
  { label: '50–75', min: 50, max: 75 },
  { label: '75–100', min: 75, max: 100.01 },
];

/**
 * Build the dashboard data for a procurement org in a single set of
 * queries. Uses the service-role client by way of the upstream layout's
 * server client — RLS already gates each table for procurement reads.
 */
export async function loadProcurementDashboard(
  supabase: SupabaseClient,
  procurementOrgId: string,
): Promise<DashboardData> {
  const { data: skuRows } = await supabase
    .from('procurement_skus')
    .select(
      `id, brand_directory_id, source_distributor_org_id, category, country_of_origin,
       volume_per_year_liters, channel_label`,
    )
    .eq('procurement_org_id', procurementOrgId)
    .eq('listing_status', 'active');

  const skus = (skuRows ?? []) as ProcurementSkuRow[];
  const distinctBrands = new Set(skus.map((s) => s.brand_directory_id));
  const distinctDistributors = new Set(skus.map((s) => s.source_distributor_org_id));

  // --- Channels (lookup distributor names for friendly labels) ---
  const distributorIds = Array.from(distinctDistributors);
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

  const channelMap = new Map<string, ChannelBreakdown>();
  for (const sku of skus) {
    const key = sku.source_distributor_org_id;
    const entry =
      channelMap.get(key) ??
      ({
        channel: distributorNames.get(key) ?? sku.channel_label,
        distributor_org_id: key,
        sku_count: 0,
        volume_liters: 0,
        brand_count: 0,
      } as ChannelBreakdown & { _brands: Set<string> });
    (entry as ChannelBreakdown & { _brands?: Set<string> })._brands =
      (entry as ChannelBreakdown & { _brands?: Set<string> })._brands ?? new Set<string>();
    (entry as ChannelBreakdown & { _brands: Set<string> })._brands.add(sku.brand_directory_id);
    entry.sku_count += 1;
    entry.volume_liters += sku.volume_per_year_liters ?? 0;
    channelMap.set(key, entry);
  }
  const channels: ChannelBreakdown[] = Array.from(channelMap.values())
    .map((c) => {
      const withBrands = c as ChannelBreakdown & { _brands: Set<string> };
      return {
        channel: c.channel,
        distributor_org_id: c.distributor_org_id,
        sku_count: c.sku_count,
        volume_liters: c.volume_liters,
        brand_count: withBrands._brands.size,
      };
    })
    .sort((a, b) => b.sku_count - a.sku_count);

  // --- Categories ---
  const categoryMap = new Map<string, number>();
  for (const sku of skus) {
    const key = sku.category?.trim() || 'Unknown';
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  }
  const categories: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, sku_count]) => ({ category, sku_count }))
    .sort((a, b) => b.sku_count - a.sku_count);

  // --- Directory rows for country, tier, name ---
  const directoryRows: DirectoryRow[] = [];
  if (distinctBrands.size > 0) {
    const { data } = await supabase
      .from('brand_directory')
      .select(
        `id, name, country_of_origin, category, sustainability_score,
         completeness_score, score_tier, alkatera_org_id`,
      )
      .in('id', Array.from(distinctBrands));
    for (const row of (data ?? []) as DirectoryRow[]) directoryRows.push(row);
  }
  const directoryById = new Map(directoryRows.map((d) => [d.id, d]));

  // --- Countries (one per brand, weighted by SKU count) ---
  const countrySkuMap = new Map<string, { sku_count: number; brands: Set<string> }>();
  for (const sku of skus) {
    const dir = directoryById.get(sku.brand_directory_id);
    const country =
      dir?.country_of_origin?.trim() || sku.country_of_origin?.trim() || 'Unknown';
    const entry = countrySkuMap.get(country) ?? { sku_count: 0, brands: new Set<string>() };
    entry.sku_count += 1;
    entry.brands.add(sku.brand_directory_id);
    countrySkuMap.set(country, entry);
  }
  const countries: CountryBreakdown[] = Array.from(countrySkuMap.entries())
    .map(([country, v]) => ({ country, sku_count: v.sku_count, brand_count: v.brands.size }))
    .sort((a, b) => b.sku_count - a.sku_count);

  // --- Tier distribution ---
  const tierMap = new Map<TierDistribution['tier'], { brand_count: Set<string>; sku_count: number }>();
  for (const tier of TIER_ORDER) {
    tierMap.set(tier, { brand_count: new Set<string>(), sku_count: 0 });
  }
  for (const sku of skus) {
    const dir = directoryById.get(sku.brand_directory_id);
    const tier: TierDistribution['tier'] = dir?.score_tier ?? 'unknown';
    const entry = tierMap.get(tier)!;
    entry.brand_count.add(sku.brand_directory_id);
    entry.sku_count += 1;
  }
  const tiers: TierDistribution[] = TIER_ORDER.map((tier) => {
    const v = tierMap.get(tier)!;
    return { tier, brand_count: v.brand_count.size, sku_count: v.sku_count };
  });

  // --- Completeness bands ---
  const bands: CompletenessBand[] = COMPLETENESS_BAND_DEFS.map((b) => ({ label: b.label, count: 0 }));
  for (const dir of directoryRows) {
    const score = dir.completeness_score ?? 0;
    const idx = COMPLETENESS_BAND_DEFS.findIndex((b) => score >= b.min && score < b.max);
    if (idx >= 0) bands[idx].count += 1;
    else bands[0].count += 1;
  }

  // --- Per-brand summary for top wins / top gaps ---
  const brandAggregator = new Map<
    string,
    {
      brand_directory_id: string;
      sku_count: number;
      volume_liters: number;
      channels: Set<string>;
    }
  >();
  for (const sku of skus) {
    const entry =
      brandAggregator.get(sku.brand_directory_id) ??
      {
        brand_directory_id: sku.brand_directory_id,
        sku_count: 0,
        volume_liters: 0,
        channels: new Set<string>(),
      };
    entry.sku_count += 1;
    entry.volume_liters += sku.volume_per_year_liters ?? 0;
    entry.channels.add(distributorNames.get(sku.source_distributor_org_id) ?? sku.channel_label);
    brandAggregator.set(sku.brand_directory_id, entry);
  }
  const brandSummaries: BrandSummary[] = Array.from(brandAggregator.values())
    .map((b) => {
      const dir = directoryById.get(b.brand_directory_id);
      return {
        brand_directory_id: b.brand_directory_id,
        name: dir?.name ?? '(unknown)',
        country_of_origin: dir?.country_of_origin ?? null,
        category: dir?.category ?? null,
        sustainability_score: dir?.sustainability_score ?? null,
        completeness_score: dir?.completeness_score ?? null,
        score_tier: dir?.score_tier ?? null,
        alkatera_org_id: dir?.alkatera_org_id ?? null,
        sku_count: b.sku_count,
        volume_liters: b.volume_liters,
        channels: Array.from(b.channels),
      };
    })
    .filter((b) => b.name !== '(unknown)');

  const top_wins = brandSummaries
    .filter((b) => (b.sustainability_score ?? 0) > 0)
    .sort((a, b) => (b.sustainability_score ?? 0) - (a.sustainability_score ?? 0))
    .slice(0, 5);

  // Gaps weighted by procurement volume — the biggest data hole that
  // also has the biggest commercial footprint floats to the top.
  const top_gaps = brandSummaries
    .map((b) => ({
      ...b,
      _gap: b.volume_liters * (100 - (b.completeness_score ?? 0)),
    }))
    .filter((b) => (b.completeness_score ?? 100) < 75)
    .sort((a, b) => b._gap - a._gap)
    .slice(0, 5)
    .map(({ _gap: _, ...rest }) => rest);

  // --- Totals ---
  const coverage_pct =
    brandSummaries.length > 0
      ? Math.round(
          (brandSummaries.reduce((acc, b) => acc + (b.completeness_score ?? 0), 0) /
            brandSummaries.length) *
            10,
        ) / 10
      : 0;
  const leader_count =
    tierMap.get('leader')?.brand_count.size ?? 0;

  return {
    totals: {
      sku_count: skus.length,
      brand_count: distinctBrands.size,
      channel_count: distinctDistributors.size,
      coverage_pct,
      leader_count,
    },
    channels,
    categories,
    countries,
    tiers,
    completeness_bands: bands,
    top_wins,
    top_gaps,
  };
}
