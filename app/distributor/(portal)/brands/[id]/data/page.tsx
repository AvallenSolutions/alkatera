import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { DataStatusTable, type DataStatusRow } from '@/components/distributor/brand-detail/data-status-table';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function BrandDataTabPage({ params }: PageProps) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
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
    .select('id, brand_directory_id')
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!brand) return null;
  const directoryId = (brand as { brand_directory_id: string }).brand_directory_id;

  const [{ data: dataRows }, { count: unresolvedConflicts }] = await Promise.all([
    supabase
      .from('scraped_brand_data')
      .select('field_key, field_value, field_value_numeric, source_name, confidence, scraped_at')
      .eq('brand_directory_id', directoryId)
      .is('superseded_by', null)
      .order('confidence', { ascending: false }),
    supabase
      .from('brand_data_conflicts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_directory_id', directoryId)
      .is('resolution', null),
  ]);

  // When there are multiple active rows per field (mid-conflict), we
  // pick the highest-confidence one for display.
  const byField = new Map<FieldKey, DataStatusRow>();
  for (const row of (dataRows ?? []) as Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
    scraped_at: string;
  }>) {
    const existing = byField.get(row.field_key as FieldKey);
    if (!existing || row.confidence > (existing.confidence ?? 0)) {
      byField.set(row.field_key as FieldKey, {
        field_key: row.field_key as FieldKey,
        value: row.field_value,
        numeric: row.field_value_numeric,
        source: row.source_name,
        confidence: row.confidence,
        updated_at: row.scraped_at,
      });
    }
  }

  return (
    <div className="space-y-6">
      {unresolvedConflicts != null && unresolvedConflicts > 0 && (
        <Link
          href={`/distributor/brands/${params.id}/conflicts`}
          className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/15 transition-colors"
        >
          <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <div className="flex-1 text-sm">
            <span className="font-semibold text-foreground">{unresolvedConflicts}</span>{' '}
            <span className="text-muted-foreground">
              data conflict{unresolvedConflicts === 1 ? '' : 's'} need
              {unresolvedConflicts === 1 ? 's' : ''} review
            </span>
          </div>
          <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
            Resolve <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      <DataStatusTable rows={Array.from(byField.values())} />
    </div>
  );
}
