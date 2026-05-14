import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AlertTriangle,
  FileDown,
  Package,
  Globe2,
  Building,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import { WebsiteEditor } from '@/components/distributor/brand-detail/website-editor';
import { FindingStatus } from '@/components/distributor/brand-detail/finding-status';
import { CompanyDescription } from '@/components/distributor/brand-detail/company-description';
import { VitalityCard } from '@/components/distributor/brand-detail/vitality-card';
import { AlkateraRefreshButton } from '@/components/distributor/brand-detail/alkatera-refresh-button';
import { REQUIRED_FIELDS } from '@/lib/distributor/scoring/completeness-calculator';
import { FIELD_DEFINITIONS } from '@/lib/distributor/scraping/field-definitions';
import type { BrandProfile } from '@/types/distributor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

const FIELD_LABEL = new Map(FIELD_DEFINITIONS.map((f) => [f.key, f.label]));

/**
 * Brand Overview tab. The shared layout in ./layout.tsx renders the
 * header + tab nav; this page is just the Overview content.
 */
export default async function BrandOverviewPage({ params }: PageProps) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;
  const canEdit = member.role !== 'viewer';

  const { data: brand } = (await supabase
    .from('brand_profiles')
    .select('*')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle()) as { data: BrandProfile | null };
  if (!brand) return null;

  const [
    { data: scrapedRows },
    { count: skuCount },
    { count: unresolvedConflicts },
    { data: descriptionRow },
  ] = await Promise.all([
    supabase
      .from('scraped_brand_data')
      .select('field_key')
      .eq('brand_profile_id', brand.id)
      .is('superseded_by', null),
    supabase
      .from('brand_skus')
      .select('id', { count: 'exact', head: true })
      .eq('brand_profile_id', brand.id)
      .eq('listing_status', 'active'),
    supabase
      .from('brand_data_conflicts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_profile_id', brand.id)
      .is('resolution', null),
    supabase
      .from('scraped_brand_data')
      .select('field_value, source_name, source_url, scraped_at, confidence')
      .eq('brand_profile_id', brand.id)
      .eq('field_key', 'company_description')
      .is('brand_sku_id', null)
      .is('superseded_by', null)
      // Highest confidence wins: alkatera_live (0.99) outranks LLM
      // extract (0.65). When confidences tie, prefer the newer row.
      .order('confidence', { ascending: false })
      .order('scraped_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const description = (descriptionRow as {
    field_value: string | null;
    source_name: string | null;
    source_url: string | null;
    scraped_at: string | null;
  } | null) ?? null;

  const populated = new Set(((scrapedRows ?? []) as Array<{ field_key: string }>).map((r) => r.field_key));
  const missingRequired = REQUIRED_FIELDS.filter((key) => !populated.has(key));

  return (
    <div className="space-y-6">
      {unresolvedConflicts != null && unresolvedConflicts > 0 && (
        <Link
          href={`/distributor/brands/${brand.id}/data`}
          className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/15 transition-colors"
        >
          <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <div className="flex-1 text-sm">
            <span className="font-semibold text-foreground">{unresolvedConflicts}</span>{' '}
            <span className="text-muted-foreground">
              data conflict{unresolvedConflicts === 1 ? '' : 's'} need
              {unresolvedConflicts === 1 ? 's' : ''} review
            </span>
          </div>
          <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
            Open Data tab{' '}
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      <VitalityCard
        vitality={brand.sustainability_score}
        tier={brand.score_tier}
        completeness={brand.completeness_score}
      />

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <Tag className="h-4 w-4 text-sky-300" />
          </div>
          <div className="text-sm font-semibold">Key details</div>
        </div>
        <div className="px-5 pb-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <Detail icon={<Building className="h-3.5 w-3.5" />} label="Category" value={brand.category} />
            <Detail
              icon={<Globe2 className="h-3.5 w-3.5" />}
              label="Country of origin"
              value={brand.country_of_origin}
            />
            <Detail
              icon={<Package className="h-3.5 w-3.5" />}
              label="Active SKUs"
              value={String(skuCount ?? 0)}
            />
            <Detail label="alkatera tier" value={`Tier ${brand.alkatera_tier}`} />
          </dl>
        </div>
      </div>

      {brand.alkatera_org_id && (
        <AlkateraRefreshButton brandId={brand.id} brandName={brand.name} />
      )}

      <CompanyDescription
        description={description?.field_value ?? null}
        source={description?.source_name ?? null}
        updatedAt={description?.scraped_at ?? null}
        sourceUrl={description?.source_url ?? brand.website}
      />

      <WebsiteEditor brandId={brand.id} initialWebsite={brand.website} canEdit={canEdit} />

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-4">
        <FindingStatus brandId={brand.id} />
      </div>

      {missingRequired.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-amber-500/5 via-card/40 to-card/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            <div className="text-sm font-semibold">Top fields still missing</div>
          </div>
          <div className="px-5 pb-5">
            <ul className="space-y-2.5 text-sm">
              {missingRequired.slice(0, 3).map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 border-b border-border/40 last:border-b-0 pb-2.5 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full border border-amber-400/60" />
                    <span>{FIELD_LABEL.get(key) ?? key}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300">
                    Required
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant="outline"
          className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
        >
          <a
            href={`/api/distributor/reports/brand-sheet?brand_profile_id=${brand.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download data sheet PDF
          </a>
        </Button>
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
        {icon && <span className="text-sky-300">{icon}</span>}
        {label}
      </dt>
      <dd className="text-sm mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  );
}

