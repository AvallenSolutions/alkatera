import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Tag, Globe2, Building, Calendar, ShieldCheck } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { BrandDiscoveryOptOutToggle } from '@/components/admin/directory/brand-discovery-opt-out-toggle';
import { EsgBreakdownPanel, type EsgSnapshot } from '@/components/shared/esg-breakdown-panel';

export const dynamic = 'force-dynamic';

interface DirectoryRow {
  id: string;
  name: string;
  category: string | null;
  country_of_origin: string | null;
  website: string | null;
  founding_year: number | null;
  parent_company: string | null;
  description: string | null;
  aliases: string[] | null;
  alkatera_org_id: string | null;
  sustainability_score: number | null;
  completeness_score: number | null;
  score_tier: string | null;
  discovery_opt_out: boolean;
  discovered_via: string;
  created_at: string;
  updated_at: string;
}

export default async function AdminBrandDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: directoryData } = (await supabase
    .from('brand_directory')
    .select(
      'id, name, category, country_of_origin, website, founding_year, parent_company, description, aliases, ' +
        'alkatera_org_id, sustainability_score, completeness_score, score_tier, discovery_opt_out, discovered_via, created_at, updated_at',
    )
    .eq('id', params.id)
    .maybeSingle()) as { data: DirectoryRow | null };
  if (!directoryData) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center text-sm">
        Brand not found.{' '}
        <Link href="/admin/directory/brands" className="text-neon-lime underline">
          Back to brands
        </Link>
      </div>
    );
  }
  const brand = directoryData;

  const [{ data: productRows }, { count: listingCount }, { data: snapshotRow }] =
    await Promise.all([
      supabase
        .from('product_directory')
        .select('id, name, gtin, embodied_carbon_kgco2e')
        .eq('brand_directory_id', brand.id)
        .order('name'),
      supabase
        .from('brand_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('brand_directory_id', brand.id),
      // ESG breakdown from the brand's alka**tera** vitality card. Only
      // relevant for alka**tera**-linked brands; skip the query otherwise.
      brand.alkatera_org_id
        ? supabase
            .from('esg_score_snapshots')
            .select('composite, environmental, social, governance, breakdown')
            .eq('organization_id', brand.alkatera_org_id)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  type ProductRow = {
    id: string;
    name: string;
    gtin: string | null;
    embodied_carbon_kgco2e: number | null;
  };
  const products = (productRows ?? []) as ProductRow[];
  const snapshot = (snapshotRow as EsgSnapshot | null) ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/directory/brands"
        className="text-sm text-muted-foreground hover:text-neon-lime inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to brands
      </Link>

      <div className="rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 via-background to-background p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{brand.name}</h1>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {brand.alkatera_org_id && (
                <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-emerald-500/15 border-emerald-400/30 text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> on alkatera
                </span>
              )}
              <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/70">
                {brand.discovered_via.replace(/_/g, ' ')}
              </span>
              {brand.score_tier && (
                <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-sky-500/15 border-sky-400/30 text-sky-200">
                  {brand.score_tier}
                </span>
              )}
              <span className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/60">
                listed by {listingCount ?? 0}
              </span>
            </div>
            {brand.description && (
              <p className="text-sm text-muted-foreground max-w-3xl pt-2">{brand.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Sustainability score
            </div>
            <div className="text-5xl font-semibold tabular-nums mt-1">
              {brand.sustainability_score != null ? Math.round(brand.sustainability_score) : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {brand.completeness_score != null
                ? `${Math.round(brand.completeness_score)}% coverage`
                : 'no data'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 px-5 py-4">
        <div className="text-sm font-semibold mb-3">Brand details</div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <Detail icon={<Building className="h-3.5 w-3.5" />} label="Category" value={brand.category} />
          <Detail
            icon={<Globe2 className="h-3.5 w-3.5" />}
            label="Country of origin"
            value={brand.country_of_origin}
          />
          <Detail
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Founded"
            value={brand.founding_year ? String(brand.founding_year) : null}
          />
          <Detail
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Parent company"
            value={brand.parent_company}
          />
        </dl>
        {brand.website && (
          <div className="text-sm pt-3">
            <a
              href={brand.website}
              target="_blank"
              rel="noreferrer"
              className="text-neon-lime hover:underline"
            >
              {brand.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {brand.aliases && brand.aliases.length > 0 && (
          <div className="text-[12px] text-muted-foreground pt-3">
            Aliases: {brand.aliases.join(', ')}
          </div>
        )}
      </div>

      {snapshot && <EsgBreakdownPanel snapshot={snapshot} accent="lime" />}

      <BrandDiscoveryOptOutToggle
        brandId={brand.id}
        brandName={brand.name}
        initialOptOut={brand.discovery_opt_out}
      />

      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="px-5 pt-5 pb-3 text-sm font-semibold">
          Products{' '}
          <span className="text-muted-foreground/70 font-normal">({products.length})</span>
        </div>
        <div className="px-5 pb-5">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products on file yet.{' '}
              <Link
                href="/admin/directory/products/upload"
                className="text-neon-lime hover:underline"
              >
                Upload a products CSV
              </Link>{' '}
              to seed them.
            </p>
          ) : (
            <ul className="text-sm space-y-2">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b border-border/40 last:border-b-0 pb-2 last:pb-0"
                >
                  <Link
                    href={`/admin/directory/products/${p.id}`}
                    className="hover:text-neon-lime"
                  >
                    {p.name}
                  </Link>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {p.gtin && <span className="mr-3">GTIN {p.gtin}</span>}
                    {p.embodied_carbon_kgco2e != null && (
                      <span className="text-sky-300">
                        {p.embodied_carbon_kgco2e.toFixed(2)} kgCO₂e
                      </span>
                    )}
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
