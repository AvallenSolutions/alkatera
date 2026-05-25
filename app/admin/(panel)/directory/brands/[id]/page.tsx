import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Tag, Globe2, Building, Calendar, ShieldCheck } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { BrandDiscoveryOptOutToggle } from '@/components/admin/directory/brand-discovery-opt-out-toggle';
import { BrandVerificationControl } from '@/components/admin/directory/brand-verification-control';
import {
  BrandLinkAlkateraControl,
  type UnlinkedOrg,
} from '@/components/admin/directory/brand-link-alkatera-control';
import {
  BrandMergeControl,
  type DuplicateCandidate,
} from '@/components/admin/directory/brand-merge-control';
import { BrandDeepEnrichControl } from '@/components/admin/directory/brand-deep-enrich-control';
import { BrandProductDedupControl } from '@/components/admin/directory/brand-product-dedup-control';
import {
  BrandCertificationsPanel,
  type CertificationFinding,
} from '@/components/admin/directory/brand-certifications-panel';
import {
  BrandAwardsPanel,
  type AwardRow,
} from '@/components/admin/directory/brand-awards-panel';
import { BrandNotableFactsPanel } from '@/components/admin/directory/brand-notable-facts-panel';
import { BrandScoreBreakdownPanel } from '@/components/admin/directory/brand-score-breakdown-panel';
import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '@/lib/distributor/scraping/field-definitions';
import { calculateVitality, type FieldValue } from '@/lib/distributor/scoring/vitality-calculator';
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
  notable_facts: string[] | null;
  alkatera_org_id: string | null;
  sustainability_score: number | null;
  completeness_score: number | null;
  score_tier: string | null;
  discovery_opt_out: boolean;
  discovered_via: string;
  verification_status: 'pending' | 'verified' | 'rejected';
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
        'alkatera_org_id, sustainability_score, completeness_score, score_tier, discovery_opt_out, discovered_via, verification_status, notable_facts, created_at, updated_at',
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

  const [
    { data: productRows },
    { count: listingCount },
    { data: snapshotRow },
    unlinkedOrgs,
    duplicateCandidates,
    { data: scrapedFindings },
    { data: awardRows },
  ] = await Promise.all([
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
    // Unlinked alka**tera** customer orgs — surfaced as options in the
    // manual "link to alkatera customer" control for unlinked directory
    // rows. Skip the query when the row is already linked.
    brand.alkatera_org_id ? Promise.resolve([] as UnlinkedOrg[]) : loadUnlinkedOrgs(supabase),
    loadDuplicateCandidates(supabase, brand.id),
    supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, field_value_numeric, source_name, source_url, confidence')
      .eq('brand_directory_id', brand.id)
      .is('superseded_by', null)
      .is('brand_sku_id', null),
    supabase
      .from('brand_awards')
      .select('id, awarding_body, award_name, medal_tier, year, source_url, notes, product_directory_id')
      .eq('brand_directory_id', brand.id)
      .order('year', { ascending: false, nullsFirst: false }),
  ]);
  type ProductRow = {
    id: string;
    name: string;
    gtin: string | null;
    embodied_carbon_kgco2e: number | null;
  };
  const products = (productRows ?? []) as ProductRow[];
  const snapshot = (snapshotRow as EsgSnapshot | null) ?? null;

  // ── Score breakdown: re-run the vitality calculator on the latest
  //    findings so the panel reflects what's actually in the DB right
  //    now, not whatever was persisted on the last recalc tick.
  type FindingRow = {
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    source_url: string | null;
    confidence: number;
  };
  const findings = ((scrapedFindings ?? []) as FindingRow[]);
  const activeByField = pickActivePerFieldServer(findings);
  const valuesMap = new Map<FieldKey, FieldValue>();
  for (const [key, row] of Array.from(activeByField.entries())) {
    valuesMap.set(key, {
      field_key: key,
      text: row.field_value ?? '',
      numeric: row.field_value_numeric,
    });
  }
  const vitality = calculateVitality(valuesMap);
  const REQUIRED_FIELDS_DISPLAY = [
    'carbon_intensity_kgco2e_per_litre',
    'water_usage_litres_per_litre',
    'packaging_primary_material',
    'sustainability_report_url',
  ];
  const missingRequired = REQUIRED_FIELDS_DISPLAY.filter((k) => !valuesMap.has(k as FieldKey));

  // ── Certifications panel input. Every boolean cert FieldKey, with
  //    its active status + source URL (if any).
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

  // ── Awards panel input. Hydrate product names for product-level
  //    awards so the chip shows the SKU.
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
  const awardRowsTyped = ((awardRows ?? []) as AwardRowDb[]);
  const productNameById = new Map<string, string>();
  for (const p of products) productNameById.set(p.id, p.name);
  const awards: AwardRow[] = awardRowsTyped.map((a) => ({
    ...a,
    product_name: a.product_directory_id ? productNameById.get(a.product_directory_id) ?? null : null,
  }));

  const notableFacts = brand.notable_facts ?? [];

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

      <BrandVerificationControl
        brandId={brand.id}
        brandName={brand.name}
        initialStatus={brand.verification_status}
      />

      {!brand.alkatera_org_id && unlinkedOrgs.length > 0 && (
        <BrandLinkAlkateraControl
          brandId={brand.id}
          brandName={brand.name}
          unlinkedOrgs={unlinkedOrgs}
        />
      )}

      {duplicateCandidates.length > 0 && (
        <BrandMergeControl
          canonicalId={brand.id}
          canonicalName={brand.name}
          candidates={duplicateCandidates}
        />
      )}

      <BrandDeepEnrichControl
        brandId={brand.id}
        brandName={brand.name}
        hasWebsite={!!brand.website}
      />

      <BrandProductDedupControl brandId={brand.id} productCount={products.length} />

      <BrandScoreBreakdownPanel
        overall={vitality.overall}
        tier={vitality.tier}
        byPillar={vitality.by_pillar}
        missingRequired={missingRequired}
      />

      <BrandNotableFactsPanel facts={notableFacts} />

      <BrandCertificationsPanel brandName={brand.name} certifications={certifications} />

      <BrandAwardsPanel awards={awards} />

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

/**
 * Find directory rows that look like duplicates of the given canonical
 * row. Candidates: rows that share the normalised name (exact dupes
 * after the descriptor stripping) plus fuzzy matches >=0.85. Limit to
 * a small set so the UI stays focused.
 */
async function loadDuplicateCandidates(
  supabase: SupabaseClient,
  canonicalId: string,
): Promise<DuplicateCandidate[]> {
  const { data: canonical } = await supabase
    .from('brand_directory')
    .select('id, name, normalized_name')
    .eq('id', canonicalId)
    .maybeSingle();
  if (!canonical) return [];
  const canon = canonical as { id: string; name: string; normalized_name: string };

  // Use match_brand_directory to find the top candidates; filter out
  // the canonical row itself.
  const { data } = await supabase.rpc('match_brand_directory', {
    query_name: canon.name,
    similarity_threshold: 0.85,
  });
  const matches = (data ?? []) as Array<{
    id: string;
    name: string;
    normalized_name: string;
    alkatera_org_id: string | null;
    similarity: number;
    match_via: 'exact_name' | 'alias' | 'fuzzy';
  }>;

  const candidates = matches.filter((m) => m.id !== canon.id);
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);
  const [{ data: details }, { data: productRows }] = await Promise.all([
    supabase
      .from('brand_directory')
      .select('id, verification_status, discovered_via')
      .in('id', ids),
    supabase
      .from('product_directory')
      .select('brand_directory_id')
      .in('brand_directory_id', ids),
  ]);
  type DetailRow = {
    id: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    discovered_via: string;
  };
  const detailById = new Map<string, DetailRow>();
  for (const d of (details ?? []) as DetailRow[]) detailById.set(d.id, d);
  const productCounts = new Map<string, number>();
  for (const p of (productRows ?? []) as Array<{ brand_directory_id: string }>) {
    productCounts.set(p.brand_directory_id, (productCounts.get(p.brand_directory_id) ?? 0) + 1);
  }

  return candidates.map((c) => {
    const detail = detailById.get(c.id);
    return {
      id: c.id,
      name: c.name,
      normalized_name: c.normalized_name,
      alkatera_org_id: c.alkatera_org_id,
      verification_status: detail?.verification_status ?? 'pending',
      discovered_via: detail?.discovered_via ?? 'manual',
      similarity: c.similarity,
      match_via:
        c.match_via === 'exact_name' || c.match_via === 'alias' ? 'exact' : 'fuzzy',
      product_count: productCounts.get(c.id) ?? 0,
    };
  });
}

/**
 * Pull alka**tera** organisations that aren't yet linked to any
 * brand_directory row. Cap at a small number — these are surfaced in a
 * dropdown for the manual link control, and admins typically know
 * exactly which org they mean.
 */
async function loadUnlinkedOrgs(supabase: SupabaseClient): Promise<UnlinkedOrg[]> {
  const { data: linkedRows } = await supabase
    .from('brand_directory')
    .select('alkatera_org_id')
    .not('alkatera_org_id', 'is', null);
  const linkedIds = new Set(
    ((linkedRows ?? []) as Array<{ alkatera_org_id: string }>).map((r) => r.alkatera_org_id),
  );

  const { data } = await supabase
    .from('organizations')
    .select('id, name, website, country')
    .not('name', 'is', null)
    .order('name')
    .limit(200);
  return ((data ?? []) as UnlinkedOrg[]).filter((o) => !linkedIds.has(o.id));
}

interface FindingForActive {
  field_key: string;
  field_value: string | null;
  field_value_numeric: number | null;
  source_name: string;
  source_url: string | null;
  confidence: number;
}

/**
 * Pick the active row per field. Mirrors data-merger's pickActivePerField
 * precedence (brand_verified > alkatera_live > highest confidence) so
 * the breakdown + certifications panels show the same active values
 * the distributor side sees.
 */
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
        {icon && <span className="text-neon-lime">{icon}</span>}
        {label}
      </dt>
      <dd className="text-sm mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  );
}
