import type { SupabaseClient } from '@supabase/supabase-js';
import { Download, FileBadge, FileSpreadsheet, BarChart3, ArrowRight } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { PageHeader } from '@/components/procurement/layout/page-header';

export const dynamic = 'force-dynamic';

export default async function ProcurementReportsPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;

  const { data: org } = await supabase
    .from('procurement_organizations')
    .select('id, display_name, name, parent_company')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!org) return null;
  const orgRow = org as {
    id: string;
    display_name: string | null;
    name: string;
    parent_company: string | null;
  };

  const { count: skuCount } = await supabase
    .from('procurement_skus')
    .select('id', { count: 'exact', head: true })
    .eq('procurement_org_id', orgRow.id)
    .eq('listing_status', 'active');

  const displayName = orgRow.display_name ?? orgRow.name;
  const ready = (skuCount ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        pill="Reports"
        pillIcon={BarChart3}
        title={`${displayName} reports`}
        subtitle="Client-facing PDF and raw CSV exports. Pulled from the same aggregator the dashboard uses, so the numbers always match what's on screen."
      />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ReportTile
          href={`/api/procurement/${params.slug}/reports/portfolio`}
          ready={ready}
          icon={FileBadge}
          title="Portfolio PDF"
          description={`A client-ready A4 report. Cover, headline stats, channel split, tier mix, top wins, top gaps and methodology, all branded with ${displayName}'s identity.`}
          cta="Generate report"
        />
        <ReportTile
          href={`/api/procurement/${params.slug}/reports/portfolio.csv`}
          ready={ready}
          icon={FileSpreadsheet}
          title="Portfolio CSV"
          description="Flat per-SKU export with brand-level sustainability fields joined in. For slicing the data outside the portal."
          cta="Download CSV"
        />
      </section>
    </div>
  );
}

function ReportTile({
  href,
  ready,
  icon: Icon,
  title,
  description,
  cta,
}: {
  href: string;
  ready: boolean;
  icon: typeof FileBadge;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <a
      href={href}
      aria-disabled={!ready}
      className={`group rounded-2xl border border-border/80 bg-card p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all flex flex-col gap-5 ${
        ready
          ? 'hover:border-brand-primary/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
          : 'opacity-60 pointer-events-none'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="inline-flex items-center justify-center rounded-xl bg-brand-primary/10 border border-brand-primary/20 h-11 w-11">
          <Icon className="h-5 w-5 text-brand-primary" />
        </div>
        <Download className="h-4 w-4 text-muted-foreground group-hover:text-brand-primary transition-colors" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-foreground/70 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <span className="text-sm font-semibold text-brand-primary inline-flex items-center gap-1.5">
          {cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        {!ready ? (
          <span className="text-[11px] text-muted-foreground">Available once SKUs are imported</span>
        ) : null}
      </div>
    </a>
  );
}
