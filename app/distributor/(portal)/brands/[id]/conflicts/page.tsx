import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { ConflictResolverUI, type ConflictRow } from '@/components/distributor/documents/conflict-resolver-ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function BrandConflictsPage({ params }: PageProps) {
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
  const canResolve = member.role !== 'viewer';

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, name')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!brand) return null;

  const { data: conflicts } = (await supabase
    .from('brand_data_conflicts')
    .select(
      'id, brand_profile_id, field_key, existing_value, existing_source, existing_confidence, new_value, new_source, new_confidence, submission_id, created_at',
    )
    .eq('brand_profile_id', brand.id)
    .is('resolution', null)
    .order('created_at', { ascending: false })) as { data: ConflictRow[] | null };

  const rows = (conflicts ?? []).map((r) => ({ ...r, brand_name: brand.name }));

  return (
    <div className="space-y-6">
      <Link
        href={`/distributor/brands/${brand.id}`}
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to {brand.name}
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
            <AlertTriangle className="h-6 w-6 text-amber-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              {rows.length} conflict{rows.length === 1 ? '' : 's'} to review
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Data conflicts</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              The brand uploaded values that disagree with what we have on file. Choose which
              version to keep for each field.
            </p>
          </div>
        </div>
      </div>

      <ConflictResolverUI conflicts={rows} canResolve={canResolve} />
    </div>
  );
}
