import type { SupabaseClient } from '@supabase/supabase-js';
import { Mail, Check, Clock, AlertCircle } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { PageHeader } from '@/components/procurement/layout/page-header';

export const dynamic = 'force-dynamic';

/**
 * Read-only outreach view for a procurement org. Aggregates outreach
 * state from every brand_profile listed by linked distributors.
 * Distributors own the actual send button in their own portal at
 * /distributor/outreach.
 */
export default async function ProcurementOutreachPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: org } = await supabase
    .from('procurement_organizations')
    .select('id, name, display_name')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!org) return null;
  const orgRow = org as { id: string; name: string; display_name: string | null };

  const { data: linkRows } = await supabase
    .from('procurement_distributor_links')
    .select(
      `distributor_org_id, channel_label,
       distributor_organizations:distributor_org_id ( id, name )`,
    )
    .eq('procurement_org_id', orgRow.id)
    .eq('status', 'active');

  type LinkRow = {
    distributor_org_id: string;
    channel_label: string;
    distributor_organizations:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
  };
  const distributorById = new Map<string, string>();
  for (const link of (linkRows ?? []) as LinkRow[]) {
    const d = Array.isArray(link.distributor_organizations)
      ? link.distributor_organizations[0]
      : link.distributor_organizations;
    distributorById.set(link.distributor_org_id, d?.name ?? link.channel_label);
  }
  const distributorIds = Array.from(distributorById.keys());

  const { data: procurementSkus } = await supabase
    .from('procurement_skus')
    .select('brand_directory_id, source_distributor_org_id')
    .eq('procurement_org_id', orgRow.id)
    .eq('listing_status', 'active');
  const inScopeBrandKeys = new Set(
    ((procurementSkus ?? []) as Array<{
      brand_directory_id: string;
      source_distributor_org_id: string;
    }>).map((s) => `${s.source_distributor_org_id}::${s.brand_directory_id}`),
  );

  const { data: brandRows } =
    distributorIds.length > 0
      ? await supabase
          .from('brand_profiles')
          .select(
            `id, name, distributor_org_id, brand_directory_id,
             outreach_email, outreach_sent_at, outreach_last_reminder_at,
             outreach_reminder_count, first_submission_at, last_submission_at,
             completeness_score, score_tier`,
          )
          .in('distributor_org_id', distributorIds)
      : { data: [] };

  type BrandRow = {
    id: string;
    name: string;
    distributor_org_id: string;
    brand_directory_id: string;
    outreach_email: string | null;
    outreach_sent_at: string | null;
    outreach_last_reminder_at: string | null;
    outreach_reminder_count: number;
    first_submission_at: string | null;
    last_submission_at: string | null;
    completeness_score: number | null;
    score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  };

  const inScope = ((brandRows ?? []) as BrandRow[]).filter((b) =>
    inScopeBrandKeys.has(`${b.distributor_org_id}::${b.brand_directory_id}`),
  );

  let submitted = 0;
  let outreachSent = 0;
  let outreachPending = 0;
  let noEmail = 0;
  for (const b of inScope) {
    if (b.first_submission_at) submitted += 1;
    else if (b.outreach_sent_at) outreachSent += 1;
    else if (b.outreach_email) outreachPending += 1;
    else noEmail += 1;
  }

  const stage = (b: BrandRow): number => {
    if (b.first_submission_at) return 3;
    if (b.outreach_sent_at) return 2;
    if (b.outreach_email) return 1;
    return 4;
  };
  inScope.sort((a, b) => {
    if (stage(a) !== stage(b)) return stage(a) - stage(b);
    const aTime = a.outreach_sent_at ?? a.first_submission_at ?? '';
    const bTime = b.outreach_sent_at ?? b.first_submission_at ?? '';
    return bTime.localeCompare(aTime);
  });

  const displayName = orgRow.display_name ?? orgRow.name;

  return (
    <div className="space-y-8">
      <PageHeader
        pill="Outreach"
        pillIcon={Mail}
        title={
          distributorIds.length === 0
            ? 'Outreach'
            : `Outreach across ${distributorIds.length} ${distributorIds.length === 1 ? 'channel' : 'channels'}`
        }
        subtitle={`Read-only view of brand outreach driven by your linked distributors. The actual send button lives in each distributor's portal. Distributors sign emails as their own organisation, co-branded with ${displayName}.`}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OutreachStat label="Submitted" value={submitted} tone="success" />
        <OutreachStat label="Awaiting brand" value={outreachSent} tone="info" />
        <OutreachStat label="Ready to send" value={outreachPending} tone="warning" />
        <OutreachStat label="No email" value={noEmail} tone="muted" />
      </section>

      {inScope.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 px-8 flex flex-col items-center text-center gap-3">
          <div className="rounded-2xl bg-brand-primary/10 border border-brand-primary/20 p-4">
            <Mail className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No brands in scope yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Upload a SKU list to populate this view. Distributors will then see which
              brands need outreach in their own portal.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Brand
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Channel
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Status
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Last contact
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Submitted
                </th>
                <th className="text-right px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {inScope.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-4 font-medium text-foreground">{b.name}</td>
                  <td className="px-5 py-4 text-foreground/70">
                    {distributorById.get(b.distributor_org_id) ?? '—'}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge brand={b} />
                  </td>
                  <td className="px-5 py-4 text-[11px] text-muted-foreground">
                    {b.outreach_last_reminder_at
                      ? `Reminder ${new Date(b.outreach_last_reminder_at).toLocaleDateString('en-GB')}`
                      : b.outreach_sent_at
                        ? new Date(b.outreach_sent_at).toLocaleDateString('en-GB')
                        : '—'}
                  </td>
                  <td className="px-5 py-4 text-[11px] text-muted-foreground">
                    {b.first_submission_at
                      ? new Date(b.first_submission_at).toLocaleDateString('en-GB')
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium">
                    {b.completeness_score != null
                      ? `${Math.round(b.completeness_score)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OutreachStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'info' | 'warning' | 'muted';
}) {
  const toneStyle: Record<typeof tone, { value: string; dot: string; bg: string; border: string }> = {
    success: { value: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50/60', border: 'border-emerald-200' },
    info: { value: 'text-brand-primary', dot: 'bg-brand-primary', bg: 'bg-brand-primary/5', border: 'border-brand-primary/20' },
    warning: { value: 'text-amber-700', dot: 'bg-amber-500', bg: 'bg-amber-50/60', border: 'border-amber-200' },
    muted: { value: 'text-stone-600', dot: 'bg-stone-400', bg: 'bg-card', border: 'border-border' },
  };
  const t = toneStyle[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
        {label}
      </div>
      <div className={`text-[28px] font-semibold tabular-nums leading-none mt-3 tracking-tight ${t.value}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  brand,
}: {
  brand: {
    outreach_email: string | null;
    outreach_sent_at: string | null;
    first_submission_at: string | null;
  };
}) {
  if (brand.first_submission_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <Check className="h-3 w-3" /> Submitted
      </span>
    );
  }
  if (brand.outreach_sent_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2 py-0.5">
        <Clock className="h-3 w-3" /> Awaiting brand
      </span>
    );
  }
  if (brand.outreach_email) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <Mail className="h-3 w-3" /> Ready to send
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-stone-600 bg-stone-50 border border-stone-200 rounded-full px-2 py-0.5">
      <AlertCircle className="h-3 w-3" /> No email
    </span>
  );
}
