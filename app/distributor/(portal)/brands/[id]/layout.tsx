import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Building2, MapPin } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { Badge } from '@/components/ui/badge';
import { BrandTabs } from '@/components/distributor/brand-detail/brand-tabs';

const TIER_BADGE: Record<number, string> = {
  1: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  2: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  3: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  4: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export const dynamic = 'force-dynamic';

interface LayoutProps {
  params: { id: string };
  children: React.ReactNode;
}

/**
 * Shared shell for every /distributor/brands/[id]/* route:
 *   - Back link to the brand list
 *   - Brand name + identity badges
 *   - Tab navigation (Overview / Data / Documents / Outreach)
 *
 * Each tab is its own route under this layout so navigation is real,
 * back-button-friendly, and Suspense-streaming-compatible.
 */
export default async function BrandDetailLayout({ params, children }: LayoutProps) {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, name, alkatera_tier, category, country_of_origin')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!brand) {
    return (
      <div className="space-y-4">
        <Link
          href="/distributor/brands"
          className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back to brands
        </Link>
        <div className="border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Brand not found in your portfolio.
        </div>
      </div>
    );
  }

  const { count: conflicts } = await supabase
    .from('brand_data_conflicts')
    .select('id', { count: 'exact', head: true })
    .eq('brand_directory_id', (brand as { brand_directory_id: string }).brand_directory_id)
    .is('resolution', null);

  return (
    <div className="space-y-6">
      <Link
        href="/distributor/brands"
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to brands
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Building2 className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              Brand profile
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{brand.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`text-[10px] uppercase tracking-wider font-semibold ${TIER_BADGE[brand.alkatera_tier] ?? ''}`}
              >
                Tier {brand.alkatera_tier}
              </Badge>
              {brand.category && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground"
                >
                  {brand.category}
                </Badge>
              )}
              {brand.country_of_origin && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {brand.country_of_origin}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <BrandTabs brandId={brand.id} unresolvedConflicts={conflicts ?? 0} />

      <div className="pt-1">{children}</div>
    </div>
  );
}
