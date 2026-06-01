import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ChevronLeft,
  Globe2,
  Tag,
  Building,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Package,
  ExternalLink,
} from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import {
  readMergedBrandData,
  pickActivePerField,
} from '@/lib/distributor/integration/data-merger';
import {
  FIELD_DEFINITIONS,
  type FieldKey,
} from '@/lib/distributor/scraping/field-definitions';
import { ContactBrandDialog } from '@/components/distributor/discover/contact-brand-dialog';
import { logBrandView } from '@/lib/admin/telemetry/log';
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
  alkatera_org_id: string | null;
  sustainability_score: number | null;
  score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  completeness_score: number | null;
  last_synced_at: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  container_size_ml: number | null;
  container_format: string | null;
  abv: number | null;
  embodied_carbon_kgco2e: number | null;
  embodied_water_l: number | null;
}


export default async function DiscoverBrandDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;
  const distributorOrgId = (member as { distributor_org_id: string }).distributor_org_id;

  const { data: directoryData } = (await supabase
    .from('brand_directory')
    .select(
      'id, name, category, country_of_origin, website, founding_year, parent_company, description, ' +
        'alkatera_org_id, sustainability_score, score_tier, completeness_score, last_synced_at, ' +
        'discovery_opt_out, verification_status',
    )
    .eq('id', params.id)
    .maybeSingle()) as {
    data: (DirectoryRow & { discovery_opt_out: boolean; verification_status: string }) | null;
  };
  if (!directoryData) return notFound();
  if (directoryData.discovery_opt_out) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
        This brand has opted out of the discovery directory.{' '}
        <Link href="/distributor/discover" className="text-sky-300 underline">
          Back to Discover
        </Link>
      </div>
    );
  }
  // Verification gate — only verified brands are browsable in Discover.
  if (directoryData.verification_status !== 'verified') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
        This brand isn't available in the directory yet.{' '}
        <Link href="/distributor/discover" className="text-sky-300 underline">
          Back to Discover
        </Link>
      </div>
    );
  }
  const directory = directoryData;

  // Fire-and-forget brand-view telemetry. Powers the admin "top viewed
  // brands" panel and helps brands see how often distributors look
  // them up.
  void logBrandView(supabase, {
    brandDirectoryId: directory.id,
    distributorOrgId,
    userId,
  });

  const [
    { data: listingRow },
    { data: productRows },
    { data: snapshotRow },
    findings,
  ] = await Promise.all([
    supabase
      .from('brand_profiles')
      .select('id, listing_status')
      .eq('distributor_org_id', distributorOrgId)
      .eq('brand_directory_id', directory.id)
      .maybeSingle(),
    supabase
      .from('product_directory')
      .select(
        'id, name, category, container_size_ml, container_format, abv, embodied_carbon_kgco2e, embodied_water_l',
      )
      .eq('brand_directory_id', directory.id)
      .eq('verification_status', 'verified')
      .order('name', { ascending: true })
      .limit(100),
    directory.alkatera_org_id
      ? supabase
          .from('esg_score_snapshots')
          .select('composite, environmental, social, governance, breakdown')
          .eq('organization_id', directory.alkatera_org_id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    readMergedBrandData(supabase, directory.id, distributorOrgId),
  ]);

  const listing = listingRow as { id: string; listing_status: string } | null;
  const products = (productRows ?? []) as ProductRow[];
  const snapshot = (snapshotRow as EsgSnapshot | null) ?? null;
  const activeByField = pickActivePerField(findings);

  return (
    <div className="space-y-6">
      <Link
        href="/distributor/discover"
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Discover
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              Industry directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {directory.name}
            </h1>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {directory.alkatera_org_id && (
                <Badge
                  icon={<ShieldCheck className="h-3 w-3" />}
                  label="on alkatera"
                  bg="bg-emerald-500/15"
                  border="border-emerald-400/30"
                  text="text-emerald-300"
                />
              )}
              {listing && (
                <Badge
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  label="Listed by you"
                  bg="bg-foreground/10"
                  border="border-border/60"
                  text="text-foreground/80"
                />
              )}
              {directory.score_tier && (
                <Badge
                  label={directory.score_tier}
                  bg={tierBg(directory.score_tier)}
                  border={tierBorder(directory.score_tier)}
                  text={tierText(directory.score_tier)}
                />
              )}
            </div>
            {directory.description && (
              <p className="text-sm text-muted-foreground max-w-3xl pt-2">
                {directory.description}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Sustainability score
              </div>
              <div className="text-5xl font-semibold tabular-nums mt-1">
                {directory.sustainability_score != null
                  ? Math.round(directory.sustainability_score)
                  : '—'}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {directory.completeness_score != null
                  ? `${Math.round(directory.completeness_score)}% data coverage`
                  : 'no data'}
              </div>
            </div>
            <ContactBrandDialog
              brandDirectoryId={directory.id}
              brandName={directory.name}
              hasAlkateraLink={!!directory.alkatera_org_id}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <Tag className="h-4 w-4 text-sky-300" />
          </div>
          <div className="text-sm font-semibold">Brand details</div>
        </div>
        <div className="px-5 pb-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <Detail icon={<Building className="h-3.5 w-3.5" />} label="Category" value={directory.category} />
            <Detail
              icon={<Globe2 className="h-3.5 w-3.5" />}
              label="Country of origin"
              value={directory.country_of_origin}
            />
            <Detail
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Founded"
              value={directory.founding_year ? String(directory.founding_year) : null}
            />
            <Detail
              icon={<Building className="h-3.5 w-3.5" />}
              label="Parent company"
              value={directory.parent_company}
            />
          </dl>
          {directory.website && (
            <div className="pt-4 text-sm">
              <a
                href={directory.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {directory.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>
      </div>

      {snapshot && (
        <EsgBreakdownPanel snapshot={snapshot} />
      )}

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <Package className="h-4 w-4 text-sky-300" />
          </div>
          <div className="text-sm font-semibold">
            Products{' '}
            <span className="text-muted-foreground/70 font-normal">({products.length})</span>
          </div>
        </div>
        <div className="px-5 pb-5">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products on file for this brand yet. They'll appear here once the brand uploads an
              LCA or a distributor lists their SKUs.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
                >
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {p.category && <span>{p.category}</span>}
                    {p.container_size_ml && <span>{p.container_size_ml} ml</span>}
                    {p.abv != null && <span>{p.abv}% ABV</span>}
                    {p.embodied_carbon_kgco2e != null && (
                      <span className="text-sky-300">
                        {p.embodied_carbon_kgco2e.toFixed(2)} kgCO₂e
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <FindingsPanel activeByField={activeByField} />

      {listing && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 text-sm flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">You list this brand</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Open the brand in your portfolio to manage data, outreach and SKUs.
            </div>
          </div>
          <Link
            href={`/distributor/brands/${listing.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-400 hover:bg-sky-300 text-black font-semibold text-xs px-3 py-2 transition-colors"
          >
            Open in portfolio →
          </Link>
        </div>
      )}
    </div>
  );
}

function notFound() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center">
      <div className="text-sm font-semibold mb-1">Brand not found</div>
      <div className="text-xs text-muted-foreground">
        <Link href="/distributor/discover" className="text-sky-300 underline">
          Back to Discover
        </Link>
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

function Badge({
  icon,
  label,
  bg,
  border,
  text,
}: {
  icon?: React.ReactNode;
  label: string;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 ${bg} ${border} ${text}`}
    >
      {icon}
      {label}
    </span>
  );
}

function tierBg(tier: string): string {
  if (tier === 'leader') return 'bg-emerald-500/15';
  if (tier === 'progressing') return 'bg-sky-500/15';
  if (tier === 'developing') return 'bg-amber-500/15';
  return 'bg-foreground/10';
}
function tierBorder(tier: string): string {
  if (tier === 'leader') return 'border-emerald-400/30';
  if (tier === 'progressing') return 'border-sky-400/30';
  if (tier === 'developing') return 'border-amber-400/30';
  return 'border-border/60';
}
function tierText(tier: string): string {
  if (tier === 'leader') return 'text-emerald-300';
  if (tier === 'progressing') return 'text-sky-200';
  if (tier === 'developing') return 'text-amber-300';
  return 'text-foreground/80';
}

function FindingsPanel({
  activeByField,
}: {
  activeByField: Map<FieldKey, { field_value: string | null; source: string }>;
}) {
  const fields = FIELD_DEFINITIONS.filter((f) => activeByField.has(f.key));
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <ShieldCheck className="h-4 w-4 text-sky-300" />
        </div>
        <div className="text-sm font-semibold">
          Sustainability findings{' '}
          <span className="text-muted-foreground/70 font-normal">({fields.length})</span>
        </div>
      </div>
      <div className="px-5 pb-5">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No findings on file yet. Data accumulates as brands verify on alka
            <strong>tera</strong> or as distributors run finding on their listings.
          </p>
        ) : (
          <ul className="space-y-2">
            {fields.map((def) => {
              const row = activeByField.get(def.key)!;
              return (
                <li
                  key={def.key}
                  className="flex items-center justify-between gap-3 border-b border-border/40 last:border-b-0 pb-2 last:pb-0"
                >
                  <div className="text-sm">{def.label}</div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{row.field_value ?? '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {row.source.replace(/_/g, ' ')}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
