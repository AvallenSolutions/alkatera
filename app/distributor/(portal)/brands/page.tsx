import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import { Building2, Upload } from 'lucide-react';
import { BrandTable, type BrandTableRow } from '@/components/distributor/brand-list/brand-table';
import type { BrandProfile } from '@/types/distributor';

export const dynamic = 'force-dynamic';

export default async function DistributorBrandsPage() {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id, role, brand_scope, category_scope')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  // Phase 4: explicit column list (was '*'). The legacy score-mirror
  // columns were dropped from brand_profiles; canonical scores are
  // hydrated separately from brand_directory below.
  // Phase 5: filter out brands the brand-owner has removed from this
  // distributor's portfolio (listing_status='delisted'). The brand
  // data still lives in the canonical directory and serves every
  // other distributor that lists them.
  let brandsQuery = supabase
    .from('brand_profiles')
    .select(
      'id, brand_directory_id, distributor_org_id, alkatera_org_id, name, normalized_name, ' +
      'website, country_of_origin, category, alkatera_tier, ' +
      'outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, ' +
      'upload_token, upload_token_expires_at, ' +
      'first_submission_at, last_submission_at, ' +
      'listing_status, directory_opt_in, created_at, updated_at',
    )
    .eq('distributor_org_id', member.distributor_org_id)
    .eq('listing_status', 'active')
    .order('name', { ascending: true });

  if (member.role === 'viewer') {
    if (Array.isArray(member.brand_scope) && member.brand_scope.length > 0) {
      brandsQuery = brandsQuery.in('id', member.brand_scope);
    }
    if (Array.isArray(member.category_scope) && member.category_scope.length > 0) {
      brandsQuery = brandsQuery.in('category', member.category_scope);
    }
  }

  const { data: brands } = (await brandsQuery) as { data: BrandProfile[] | null };

  let rows: BrandTableRow[] = [];
  if (brands && brands.length > 0) {
    const brandIds = brands.map((b) => b.id);
    const directoryIds = Array.from(new Set(brands.map((b) => b.brand_directory_id)));
    const [
      { data: skuRows },
      { data: sourceRows },
      { data: jobRows },
      { data: directoryScoresRaw },
    ] = await Promise.all([
      supabase
        .from('brand_skus')
        .select('brand_profile_id, updated_at')
        .in('brand_profile_id', brandIds),
      // Source-name summary per directory entry — Phase 3 keys findings
      // by directory id, so a brand surfaced on two distributor lists
      // shares its source mix across both views.
      supabase
        .from('scraped_brand_data')
        .select('brand_directory_id, source_name')
        .in('brand_directory_id', directoryIds)
        .is('superseded_by', null),
      supabase
        .from('scraping_jobs')
        .select('brand_profile_id, status, completed_at, created_at')
        .in('brand_profile_id', brandIds)
        .order('created_at', { ascending: false }),
      // Canonical scores live on brand_directory after Phase 3.
      supabase
        .from('brand_directory')
        .select('id, sustainability_score, score_tier, completeness_score')
        .in('id', directoryIds),
    ]);

    type DirectoryScores = {
      sustainability_score: number | null;
      score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
      completeness_score: number | null;
    };
    const directoryScoresById = new Map<string, DirectoryScores>();
    for (const row of (directoryScoresRaw ?? []) as Array<{ id: string } & DirectoryScores>) {
      directoryScoresById.set(row.id, {
        sustainability_score: row.sustainability_score,
        score_tier: row.score_tier,
        completeness_score: row.completeness_score,
      });
    }

    const counts = new Map<string, { count: number; lastActivity: string | null }>();
    (skuRows ?? []).forEach((sku: { brand_profile_id: string; updated_at: string }) => {
      const existing = counts.get(sku.brand_profile_id) ?? { count: 0, lastActivity: null };
      existing.count += 1;
      if (!existing.lastActivity || sku.updated_at > existing.lastActivity) {
        existing.lastActivity = sku.updated_at;
      }
      counts.set(sku.brand_profile_id, existing);
    });

    const sourcesByDirectory = new Map<string, Set<string>>();
    (sourceRows ?? []).forEach((row: { brand_directory_id: string; source_name: string }) => {
      const set = sourcesByDirectory.get(row.brand_directory_id) ?? new Set<string>();
      set.add(row.source_name);
      sourcesByDirectory.set(row.brand_directory_id, set);
    });

    // jobRows is ordered DESC by created_at, so the first row we see
    // per brand is the latest job.
    const latestJobs = new Map<
      string,
      { status: string; when: string | null }
    >();
    (jobRows ?? []).forEach((row: {
      brand_profile_id: string;
      status: string;
      completed_at: string | null;
      created_at: string;
    }) => {
      if (latestJobs.has(row.brand_profile_id)) return;
      latestJobs.set(row.brand_profile_id, {
        status: row.status,
        when: row.completed_at ?? row.created_at,
      });
    });

    rows = brands.map((b) => {
      const stats = counts.get(b.id);
      const job = latestJobs.get(b.id);
      const scores = directoryScoresById.get(b.brand_directory_id);
      return {
        ...b,
        sustainability_score: scores?.sustainability_score ?? null,
        score_tier: scores?.score_tier ?? null,
        completeness_score: scores?.completeness_score ?? null,
        sku_count: stats?.count ?? 0,
        last_activity: stats?.lastActivity ?? null,
        data_sources: Array.from(sourcesByDirectory.get(b.brand_directory_id) ?? []),
        latest_finding_status: job?.status ?? null,
        latest_finding_at: job?.when ?? null,
      };
    });
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start justify-between flex-wrap gap-5">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              Brands portfolio
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Brands</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {rows.length} brand{rows.length === 1 ? '' : 's'} across your portfolio. Filter,
              sort and drill into any one for the full sustainability picture.
            </p>
          </div>
          {member.role !== 'viewer' && (
            <Button
              asChild
              className="bg-sky-400 hover:bg-sky-300 text-black font-semibold shrink-0"
            >
              <Link href="/distributor/sku-lists/upload">Upload product list</Link>
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 via-card/40 to-card/40 p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
          <div className="flex items-start gap-5">
            <div className="h-12 w-12 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
              <Building2 className="h-6 w-6 text-sky-300" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-300">
                  No brands yet
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Upload a product list to populate your portfolio
                </h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                We'll auto-detect every brand and SKU and start gathering sustainability data
                straight away. You'll see brand profiles fill out within minutes.
              </p>
              {member.role !== 'viewer' && (
                <div>
                  <Button
                    asChild
                    className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                  >
                    <Link href="/distributor/sku-lists/upload">
                      <Upload className="h-4 w-4 mr-1.5" /> Upload product list
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <BrandTable brands={rows} />
      )}
    </div>
  );
}
