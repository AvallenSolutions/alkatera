import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ChevronLeft,
  Tag,
  Package,
  Barcode,
  Sparkles,
  Droplets,
  Building2,
} from 'lucide-react';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { BrandAwardsPanel, type AwardRow } from '@/components/admin/directory/brand-awards-panel';
import { BrandNotableFactsPanel } from '@/components/admin/directory/brand-notable-facts-panel';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  gtin: string | null;
  brand_directory_id: string;
  category: string | null;
  abv: number | null;
  container_size_ml: number | null;
  container_format: string | null;
  recipe_overview: string | null;
  embodied_carbon_kgco2e: number | null;
  embodied_water_l: number | null;
  completeness_score: number | null;
  alkatera_product_id: string | null;
  discovered_via: string;
  notable_facts: string[] | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export default async function AdminProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getSupabaseAdminClient() as unknown as SupabaseClient;

  const { data: productData } = (await supabase
    .from('product_directory')
    .select(
      'id, name, gtin, brand_directory_id, category, abv, container_size_ml, container_format, ' +
        'recipe_overview, embodied_carbon_kgco2e, embodied_water_l, completeness_score, ' +
        'alkatera_product_id, discovered_via, notable_facts, last_synced_at, created_at, updated_at',
    )
    .eq('id', params.id)
    .maybeSingle()) as { data: ProductRow | null };
  if (!productData) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center text-sm">
        Product not found.{' '}
        <Link href="/admin/directory/products" className="text-neon-lime underline">
          Back to products
        </Link>
      </div>
    );
  }
  const product = productData;

  const [
    { data: brandRow },
    { count: listingCount },
    { data: findingRows },
    { data: awardRows },
  ] = await Promise.all([
    supabase
      .from('brand_directory')
      .select('id, name, alkatera_org_id')
      .eq('id', product.brand_directory_id)
      .maybeSingle(),
    supabase
      .from('brand_skus')
      .select('id', { count: 'exact', head: true })
      .eq('product_directory_id', product.id),
    supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, source_name, scraped_at, confidence')
      .eq('product_directory_id', product.id)
      .is('superseded_by', null)
      .order('confidence', { ascending: false }),
    supabase
      .from('brand_awards')
      .select('id, awarding_body, award_name, medal_tier, year, source_url, notes, product_directory_id')
      .eq('product_directory_id', product.id)
      .order('year', { ascending: false, nullsFirst: false }),
  ]);

  const brand = brandRow as { id: string; name: string; alkatera_org_id: string | null } | null;
  type Finding = {
    field_key: string;
    field_value: string | null;
    source_name: string;
    scraped_at: string;
    confidence: number;
  };
  // Per-field precedence: brand_verified > alkatera_live > highest
  // confidence. Mirrors pickActivePerField in lib/distributor/integration/
  // data-merger.ts so alka**tera**-customer data always wins over a
  // higher-confidence scrape.
  const bestByField = new Map<string, Finding>();
  for (const f of (findingRows ?? []) as Finding[]) {
    const existing = bestByField.get(f.field_key);
    if (!existing) {
      bestByField.set(f.field_key, f);
      continue;
    }
    if (f.source_name === 'brand_verified' && existing.source_name !== 'brand_verified') {
      bestByField.set(f.field_key, f);
      continue;
    }
    if (existing.source_name === 'brand_verified') continue;
    if (f.source_name === 'alkatera_live' && existing.source_name !== 'alkatera_live') {
      bestByField.set(f.field_key, f);
      continue;
    }
    if (existing.source_name === 'alkatera_live') continue;
    if (f.confidence > existing.confidence) {
      bestByField.set(f.field_key, f);
    }
  }
  const findings = Array.from(bestByField.values());

  type AwardRowDb = {
    id: string;
    awarding_body: string;
    award_name: string;
    medal_tier: AwardRow['medal_tier'];
    year: number | null;
    source_url: string | null;
    notes: string | null;
    product_directory_id: string | null;
  };
  const awards: AwardRow[] = ((awardRows ?? []) as AwardRowDb[]).map((a) => ({
    ...a,
    product_name: product.name,
  }));
  const notableFacts = product.notable_facts ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/directory/products"
        className="text-sm text-muted-foreground hover:text-neon-lime inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>

      <div className="rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 via-background to-background p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5 text-neon-lime" />
              {brand ? (
                <Link
                  href={`/admin/directory/brands/${brand.id}`}
                  className="hover:text-neon-lime inline-flex items-center gap-1"
                >
                  <Building2 className="h-3 w-3" />
                  {brand.name}
                </Link>
              ) : (
                <span>Unknown brand</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{product.name}</h1>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {product.gtin && (
                <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/70">
                  <Barcode className="h-3 w-3" /> GTIN {product.gtin}
                </span>
              )}
              <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/70">
                {product.discovered_via.replace(/_/g, ' ')}
              </span>
              {product.alkatera_product_id && (
                <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-emerald-500/15 border-emerald-400/30 text-emerald-300">
                  <Sparkles className="h-3 w-3" /> alkatera LCA
                </span>
              )}
              <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/60">
                listed by {listingCount ?? 0}
              </span>
            </div>
            {product.recipe_overview && (
              <p className="text-sm text-muted-foreground max-w-3xl pt-2">
                {product.recipe_overview}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Embodied carbon
              </div>
              <div className="text-3xl font-semibold tabular-nums mt-1">
                {product.embodied_carbon_kgco2e != null
                  ? product.embodied_carbon_kgco2e.toFixed(2)
                  : '—'}
              </div>
              <div className="text-[11px] text-muted-foreground">kgCO₂e</div>
            </div>
            {product.embodied_water_l != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 justify-end">
                  <Droplets className="h-3 w-3 text-sky-300" /> Water
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {product.embodied_water_l.toFixed(1)} L
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 px-5 py-4">
        <div className="text-sm font-semibold mb-3">Product details</div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <Detail icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={product.category} />
          <Detail
            label="ABV"
            value={product.abv != null ? `${product.abv}%` : null}
          />
          <Detail
            label="Container size"
            value={product.container_size_ml ? `${product.container_size_ml} ml` : null}
          />
          <Detail label="Container format" value={product.container_format} />
        </dl>
        {product.last_synced_at && (
          <div className="text-[11px] text-muted-foreground pt-3">
            LCA last synced from alka<strong>tera</strong> {formatAge(product.last_synced_at)}
          </div>
        )}
      </div>

      <BrandNotableFactsPanel facts={notableFacts} />

      <BrandAwardsPanel awards={awards} />

      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="px-5 pt-5 pb-3 text-sm font-semibold">
          Product-level findings{' '}
          <span className="text-muted-foreground/70 font-normal">({findings.length})</span>
        </div>
        <div className="px-5 pb-5">
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No product-specific findings yet. Findings attach here when a distributor uploads an
              LCA attributed to this SKU, or when alka<strong>tera</strong> product data syncs in.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {findings.map((f) => (
                <li
                  key={f.field_key}
                  className="flex items-center justify-between gap-3 border-b border-border/40 last:border-b-0 pb-2 last:pb-0"
                >
                  <span>{f.field_key.replace(/_/g, ' ')}</span>
                  <span className="text-right">
                    <span className="font-medium">{f.field_value ?? '—'}</span>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.source_name.replace(/_/g, ' ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        {icon && <span className="text-neon-lime">{icon}</span>}
        {label}
      </dt>
      <dd className="text-sm mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function formatAge(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
