import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Link2 } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { PendingMatchesUI, type PendingMatch } from '@/components/distributor/integration/pending-match-card';

export const dynamic = 'force-dynamic';

export default async function PendingMatchesPage() {
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
  const canConfirm = member.role !== 'viewer';

  // Pull every still-unlinked brand profile in the org and ask the
  // RPC for its best fuzzy alkatera candidate. We do this on demand
  // (cheap for a small portfolio) rather than persisting suggestions —
  // the source of truth for "do these look alike?" is pg_trgm, not a
  // stored snapshot.
  const { data: brands } = await supabase
    .from('brand_profiles')
    .select('id, name, normalized_name')
    .eq('distributor_org_id', member.distributor_org_id)
    .is('alkatera_org_id', null)
    .order('name');

  const matches: PendingMatch[] = [];
  for (const brand of (brands ?? []) as Array<{ id: string; name: string; normalized_name: string }>) {
    const { data: candidates } = await supabase.rpc('find_similar_organizations', {
      brand_name: brand.normalized_name,
      similarity_threshold: 0.6,
    });
    type Row = { id: string; name: string; similarity: number };
    const rows = (candidates ?? []) as Row[];
    if (rows.length === 0) continue;
    const top = rows[0];
    matches.push({
      brand_profile_id: brand.id,
      brand_name: brand.name,
      alkatera_org_id: top.id,
      alkatera_org_name: top.name,
      similarity: top.similarity,
    });
  }

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
            <Link2 className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              {matches.length} candidate{matches.length === 1 ? '' : 's'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Pending alka<strong>tera</strong> matches
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Brands whose names look similar to existing alka<strong>tera</strong> customer
              accounts. Confirm or dismiss each suggestion. Confirming sends the brand an email
              asking them to accept.
            </p>
          </div>
        </div>
      </div>

      <PendingMatchesUI matches={matches} canConfirm={canConfirm} />
    </div>
  );
}
