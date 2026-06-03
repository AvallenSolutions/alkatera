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
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { Button } from '@/components/ui/button';
import { WebsiteEditor } from '@/components/distributor/brand-detail/website-editor';
import { FindingStatus } from '@/components/distributor/brand-detail/finding-status';
import { CompanyDescription } from '@/components/distributor/brand-detail/company-description';
import { VitalityCard } from '@/components/distributor/brand-detail/vitality-card';
import { AlkateraRefreshButton } from '@/components/distributor/brand-detail/alkatera-refresh-button';
import { REQUIRED_FIELDS } from '@/lib/distributor/scoring/completeness-calculator';
import {
  FIELD_DEFINITIONS,
  type FieldKey,
} from '@/lib/distributor/scraping/field-definitions';
import { calculateScrapedVitality } from '@/lib/distributor/scoring/scraped-vitality';
import {
  BrandScoreBreakdownPanel,
  type PillarSignalsSummary,
} from '@/components/admin/directory/brand-score-breakdown-panel';
import {
  BrandCertificationsPanel,
  type CertificationFinding,
} from '@/components/admin/directory/brand-certifications-panel';
import {
  BrandAwardsPanel,
  type AwardRow,
} from '@/components/admin/directory/brand-awards-panel';
import { BrandNotableFactsPanel } from '@/components/admin/directory/brand-notable-facts-panel';
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
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;
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
    .select(
      'id, brand_directory_id, distributor_org_id, alkatera_org_id, name, normalized_name, ' +
      'website, country_of_origin, category, alkatera_tier, ' +
      'outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, ' +
      'upload_token, upload_token_expires_at, ' +
      'first_submission_at, last_submission_at, ' +
      'listing_status, directory_opt_in, created_at, updated_at',
    )
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle()) as { data: BrandProfile | null };
  if (!brand) return null;
  const directoryId = brand.brand_directory_id;

  const [
    { data: scrapedRowsFull },
    { count: skuCount },
    { count: unresolvedConflicts },
    { data: descriptionRow },
    { data: directoryScores },
    { count: listingCount },
    { data: awardsRaw },
  ] = await Promise.all([
    // All brand-level findings — we need value + source for the
    // signal-count score breakdown and the certifications panel, not
    // just the key list used for completeness.
    supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, field_value_numeric, source_name, source_url, confidence')
      .eq('brand_directory_id', directoryId)
      .is('superseded_by', null)
      .is('brand_sku_id', null),
    supabase
      .from('brand_skus')
      .select('id', { count: 'exact', head: true })
      .eq('brand_profile_id', brand.id)
      .eq('listing_status', 'active'),
    supabase
      .from('brand_data_conflicts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_directory_id', directoryId)
      .is('resolution', null),
    // Pull every active company_description finding; we apply the
    // canonical precedence (brand_verified > alkatera_live > confidence)
    // below so an alka**tera**-customer description always wins over a
    // scraped one, regardless of the scrape's confidence score.
    supabase
      .from('scraped_brand_data')
      .select('field_value, source_name, source_url, scraped_at, confidence')
      .eq('brand_directory_id', directoryId)
      .eq('field_key', 'company_description')
      .is('brand_sku_id', null)
      .is('superseded_by', null),
    supabase
      .from('brand_directory')
      .select('sustainability_score, score_tier, completeness_score, last_synced_at, notable_facts, alkatera_org_id')
      .eq('id', directoryId)
      .maybeSingle(),
    supabase
      .from('brand_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('brand_directory_id', directoryId),
    supabase
      .from('brand_awards')
      .select('id, awarding_body, award_name, medal_tier, year, source_url, notes, product_directory_id')
      .eq('brand_directory_id', directoryId)
      .order('year', { ascending: false, nullsFirst: false }),
  ]);
  const scrapedRows = scrapedRowsFull as Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    source_url: string | null;
    confidence: number;
  }> | null;

  const description = pickActiveDescription(
    (descriptionRow ?? []) as Array<{
      field_value: string | null;
      source_name: string | null;
      source_url: string | null;
      scraped_at: string | null;
      confidence: number;
    }>,
  );
  const directoryRow = directoryScores as
    | {
        sustainability_score: number | null;
        score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
        completeness_score: number | null;
        last_synced_at: string | null;
        notable_facts: string[] | null;
        alkatera_org_id: string | null;
      }
    | null;
  const scores = directoryRow;
  const otherListings = Math.max(0, (listingCount ?? 1) - 1);

  const populated = new Set((scrapedRows ?? []).map((r) => r.field_key));
  const missingRequired = REQUIRED_FIELDS.filter((key) => !populated.has(key));

  // ── Score breakdown + certifications panels. Mirror the admin
  //    panel: re-run the calculator on the live findings so what's
  //    shown matches the DB right now, even if the persisted score
  //    is a few seconds stale.
  const activeByField = pickActivePerFieldServer(scrapedRows ?? []);
  const valuesMap = new Map<FieldKey, { field_key: FieldKey; text: string; numeric: number | null }>();
  for (const [key, row] of Array.from(activeByField.entries())) {
    valuesMap.set(key, {
      field_key: key,
      text: row.field_value ?? '',
      numeric: row.field_value_numeric,
    });
  }
  // For now the distributor portal only renders the scraped (signal-
  // count) view. alka**tera**-customer brands use the same calculator
  // here; we can split to the 6-pillar alka**tera** scorer when there's
  // an obvious need.
  const vitality = calculateScrapedVitality(valuesMap);
  const signalsByPillar: Record<string, PillarSignalsSummary> = {
    environment: {
      count: vitality.signals_by_pillar.environment.count,
      signals: vitality.signals_by_pillar.environment.signals,
    },
    social: {
      count: vitality.signals_by_pillar.social.count,
      signals: vitality.signals_by_pillar.social.signals,
    },
    governance: {
      count: vitality.signals_by_pillar.governance.count,
      signals: vitality.signals_by_pillar.governance.signals,
    },
  };

  // ── Certifications panel: every boolean cert + leadership signal
  //    FieldKey, with active status + source URL.
  const CERT_KEYS: FieldKey[] = [
    'bcorp_certified',
    'carbon_trust_certified',
    'iso_14001_certified',
    'iso_50001_certified',
    'fairtrade_certified',
    'rainforest_alliance_certified',
    'organic_certified',
    'iwca_member',
    'porto_protocol_signatory',
    'epd_published',
    'carbon_negative_claim',
    'cdr_partnership',
  ];
  const certifications: CertificationFinding[] = CERT_KEYS.map((key) => {
    const row = activeByField.get(key);
    const label = FIELD_DEFINITIONS.find((f) => f.key === key)?.label ?? key;
    let isCertified: boolean | null = null;
    if (row) {
      const numeric = row.field_value_numeric;
      const text = (row.field_value ?? '').toLowerCase();
      if (numeric === 1 || text === 'true') isCertified = true;
      else if (numeric === 0 || text === 'false') isCertified = false;
    }
    return { field_key: key, label, is_certified: isCertified, source_url: row?.source_url ?? null };
  });

  // ── Awards. Hydrate product names for product-level awards so the
  //    chip shows the SKU.
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
  const awardRowsTyped = ((awardsRaw ?? []) as AwardRowDb[]);
  const productIdsForAwards = Array.from(
    new Set(awardRowsTyped.map((a) => a.product_directory_id).filter((id): id is string => !!id)),
  );
  const productNameById = new Map<string, string>();
  if (productIdsForAwards.length > 0) {
    const { data: productRows } = await supabase
      .from('product_directory')
      .select('id, name')
      .in('id', productIdsForAwards);
    for (const p of (productRows ?? []) as Array<{ id: string; name: string }>) {
      productNameById.set(p.id, p.name);
    }
  }
  const awards: AwardRow[] = awardRowsTyped.map((a) => ({
    ...a,
    product_name: a.product_directory_id ? productNameById.get(a.product_directory_id) ?? null : null,
  }));
  const notableFacts = directoryRow?.notable_facts ?? [];

  return (
    <div className="space-y-6">
      {brand.listing_status === 'delisted' && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-4 py-3 text-sm flex items-center gap-3">
          <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{brand.name}</span> asked to be removed
            from your portfolio. Their sustainability data is still on file in the directory but
            this brand is hidden from your default brand list.
          </span>
        </div>
      )}
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
        vitality={scores?.sustainability_score ?? null}
        tier={scores?.score_tier ?? null}
        completeness={scores?.completeness_score ?? null}
      />

      <BrandScoreBreakdownPanel
        overall={vitality.overall}
        tier={vitality.tier}
        byPillar={vitality.by_pillar as Record<string, number>}
        signalsByPillar={signalsByPillar}
        missingRequired={[]}
        scoringMode="scraped"
      />

      <BrandNotableFactsPanel facts={notableFacts} />

      <BrandCertificationsPanel brandName={brand.name} certifications={certifications} />

      <BrandAwardsPanel awards={awards} />

      {otherListings > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent px-4 py-3 text-sm flex items-center gap-3">
          <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[11px] font-semibold">
            Listed by {otherListings + 1} distributors
          </span>
          <span className="text-muted-foreground">
            Verified data and scraped findings are shared across every distributor that lists this
            brand.
          </span>
        </div>
      )}

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
        <div className="space-y-2">
          <AlkateraRefreshButton brandId={brand.id} brandName={brand.name} />
          {scores?.last_synced_at && (
            <p className="text-[11px] text-muted-foreground pl-1">
              Synced {formatTimeAgo(scores.last_synced_at)} from alka<strong>tera</strong>
            </p>
          )}
        </div>
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

/**
 * Pick the active company_description from a set of active findings.
 * Mirrors data-merger's pickActivePerField for a single field: prefer
 * brand_verified, then alkatera_live, then highest confidence. Tie-
 * breaks on newer scraped_at.
 */
function pickActiveDescription(
  rows: Array<{
    field_value: string | null;
    source_name: string | null;
    source_url: string | null;
    scraped_at: string | null;
    confidence: number;
  }>,
): {
  field_value: string | null;
  source_name: string | null;
  source_url: string | null;
  scraped_at: string | null;
} | null {
  let best: (typeof rows)[number] | null = null;
  for (const r of rows) {
    if (!best) {
      best = r;
      continue;
    }
    if (r.source_name === 'brand_verified' && best.source_name !== 'brand_verified') {
      best = r;
      continue;
    }
    if (best.source_name === 'brand_verified') continue;
    if (r.source_name === 'alkatera_live' && best.source_name !== 'alkatera_live') {
      best = r;
      continue;
    }
    if (best.source_name === 'alkatera_live') continue;
    if (r.confidence > best.confidence) {
      best = r;
      continue;
    }
    if (
      r.confidence === best.confidence &&
      (r.scraped_at ?? '') > (best.scraped_at ?? '')
    ) {
      best = r;
    }
  }
  return best;
}

interface FindingForActive {
  field_key: string;
  field_value: string | null;
  field_value_numeric: number | null;
  source_name: string;
  source_url: string | null;
  confidence: number;
}

/** Pick the active row per field. Mirrors data-merger's
 *  pickActivePerField precedence (brand_verified > alkatera_live >
 *  highest confidence) so the panel scores agree with the brand
 *  Data tab + admin panel + cron-persisted score. */
function pickActivePerFieldServer(rows: FindingForActive[]): Map<FieldKey, FindingForActive> {
  const byField = new Map<FieldKey, FindingForActive>();
  for (const row of rows) {
    const key = row.field_key as FieldKey;
    const existing = byField.get(key);
    if (!existing) {
      byField.set(key, row);
      continue;
    }
    if (row.source_name === 'brand_verified' && existing.source_name !== 'brand_verified') {
      byField.set(key, row);
      continue;
    }
    if (existing.source_name === 'brand_verified') continue;
    if (row.source_name === 'alkatera_live' && existing.source_name !== 'alkatera_live') {
      byField.set(key, row);
      continue;
    }
    if (existing.source_name === 'alkatera_live') continue;
    if (row.confidence > existing.confidence) byField.set(key, row);
  }
  return byField;
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

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const minutes = Math.round(diffSec / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

