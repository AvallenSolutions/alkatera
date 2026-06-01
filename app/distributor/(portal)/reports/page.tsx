import type { SupabaseClient } from '@supabase/supabase-js';
import { FileDown, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import { UpgradePrompt } from '@/components/distributor/upgrade/upgrade-prompt';
import { distributorCan } from '@/lib/distributor/capabilities';
import type { DistributorOrganization } from '@/types/distributor';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
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

  // Procurement-partner-tier distributors don't get portfolio reports.
  const { data: orgRow } = await supabase
    .from('distributor_organizations')
    .select('is_procurement_partner')
    .eq('id', member.distributor_org_id)
    .maybeSingle();
  const org = orgRow as Pick<DistributorOrganization, 'is_procurement_partner'> | null;
  if (org && !distributorCan(org, 'export_portfolio_reports')) {
    return (
      <UpgradePrompt
        capability="export_portfolio_reports"
        backHref="/distributor/dashboard"
        backLabel="Back to dashboard"
        intro="Portfolio reports are unlocked with a full alka<strong>tera</strong> subscription. Procurement reports for your linked procurement clients are produced from their portal."
      />
    );
  }

  const [{ count: brandCount }, { count: skuCount }] = await Promise.all([
    supabase
      .from('brand_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_org_id', member.distributor_org_id),
    supabase
      .from('brand_skus')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_org_id', member.distributor_org_id)
      .eq('listing_status', 'active'),
  ]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
            <BarChart3 className="h-3 w-3" />
            Exports
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Reports &amp; exports
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Download retailer-ready data exports and per-brand sustainability sheets you can send
            straight into category buyers' inboxes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
              <FileSpreadsheet className="h-4 w-4 text-sky-300" />
            </div>
            <div className="text-sm font-semibold">Portfolio CSV</div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            One row per active SKU across your portfolio. Brand-level sustainability fields are
            denormalised across each SKU so the file feeds directly into retailer data exchanges.
          </p>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Approx. export size
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {skuCount ?? 0} SKU{skuCount === 1 ? '' : 's'}
                <span className="text-muted-foreground font-normal">
                  {' '}
                  · {brandCount ?? 0} brand{brandCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
          <Button
            asChild
            className="bg-sky-400 hover:bg-sky-300 text-black font-semibold w-full sm:w-auto"
          >
            <a href="/api/distributor/reports/portfolio" target="_blank" rel="noreferrer">
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download CSV
            </a>
          </Button>
        </div>

        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
              <FileDown className="h-4 w-4 text-sky-300" />
            </div>
            <div className="text-sm font-semibold">Per-brand PDF data sheet</div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Generate a 1 to 2 page PDF data sheet for any single brand, available from each brand's
            Overview tab. The sheet groups every field by pillar and shows the source and
            confidence so it's defensible to send to retail partners.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100 w-full sm:w-auto"
          >
            <a href="/distributor/brands">Open brand list</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
