import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertTriangle } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { ConflictResolverUI, type ConflictRow } from '@/components/distributor/documents/conflict-resolver-ui';

export const dynamic = 'force-dynamic';

/**
 * Org-wide data-conflicts queue.
 *
 * Brands self-upload values via their portal link; when an uploaded value
 * disagrees with what we hold and the auto-resolver can't decide, the
 * document processor flags it (brand_data_conflicts.resolution IS NULL)
 * and leaves BOTH values active until a human picks a winner. Resolution
 * already existed per-brand (/brands/[id]/conflicts) but was undiscoverable
 * — you had to open each brand. This surfaces every pending conflict across
 * the whole portfolio in one place, reusing the same resolver UI + endpoint.
 */
export default async function ConflictsQueuePage() {
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
  const canResolve = member.role !== 'viewer';

  // Every brand listing in this org → map canonical directory id to a
  // display name so each conflict can be labelled with its brand.
  const { data: brands } = await supabase
    .from('brand_profiles')
    .select('brand_directory_id, name')
    .eq('distributor_org_id', member.distributor_org_id);
  const brandList = (brands ?? []) as Array<{ brand_directory_id: string; name: string }>;

  const nameByDirectory = new Map<string, string>();
  for (const b of brandList) {
    if (b.brand_directory_id && !nameByDirectory.has(b.brand_directory_id)) {
      nameByDirectory.set(b.brand_directory_id, b.name);
    }
  }
  const directoryIds = Array.from(nameByDirectory.keys());

  let rows: ConflictRow[] = [];
  if (directoryIds.length > 0) {
    const { data: conflicts } = (await supabase
      .from('brand_data_conflicts')
      .select(
        'id, brand_directory_id, field_key, existing_value, existing_source, existing_confidence, new_value, new_source, new_confidence, submission_id, created_at',
      )
      .in('brand_directory_id', directoryIds)
      .is('resolution', null)
      .order('created_at', { ascending: false })) as { data: ConflictRow[] | null };

    rows = (conflicts ?? []).map((r) => ({
      ...r,
      brand_name: nameByDirectory.get(r.brand_directory_id) ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
            <AlertTriangle className="h-6 w-6 text-amber-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              {rows.length} pending across your portfolio
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Data conflicts</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              When a brand uploads a value that disagrees with what we hold, we keep both until
              you decide. Choose which version to keep for each field. The chosen value updates the
              brand&apos;s score and is shared with every distributor listing that brand.
              {!canResolve && ' Your role can review but not resolve conflicts.'}
            </p>
          </div>
        </div>
      </div>

      <ConflictResolverUI conflicts={rows} canResolve={canResolve} />
    </div>
  );
}
