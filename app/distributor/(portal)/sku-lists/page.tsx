import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Upload, Inbox, FileSpreadsheet } from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DistributorSkuList } from '@/types/distributor';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  complete: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  processing: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  mapping: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  pending: 'text-muted-foreground border-muted',
  error: 'text-destructive border-destructive/30 bg-destructive/10',
};

export default async function SkuListsPage() {
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

  const { data: lists } = (await supabase
    .from('distributor_sku_lists')
    .select('*')
    .eq('distributor_org_id', member.distributor_org_id)
    .order('created_at', { ascending: false })) as { data: DistributorSkuList[] | null };

  const canUpload = member.role !== 'viewer';

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start justify-between flex-wrap gap-5">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <FileSpreadsheet className="h-3 w-3" />
              Product lists
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Product lists</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Every upload that's produced brand profiles in your portfolio.
            </p>
          </div>
          {canUpload && (
            <Button
              asChild
              className="bg-sky-400 hover:bg-sky-300 text-black font-semibold shrink-0"
            >
              <Link href="/distributor/sku-lists/upload">
                <Upload className="h-4 w-4 mr-1.5" /> Upload product list
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!lists || lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="rounded-lg bg-sky-500/10 border border-sky-400/30 p-3">
            <Inbox className="h-5 w-5 text-sky-300" />
          </div>
          <p>No uploads yet.</p>
          {canUpload && (
            <p className="text-xs text-muted-foreground">
              Upload a CSV, Excel, or PDF to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr className="border-b border-border/60 bg-background/30">
                <th className="text-left px-4 py-3.5">File</th>
                <th className="text-left px-4 py-3.5">Type</th>
                <th className="text-left px-4 py-3.5">Status</th>
                <th className="text-left px-4 py-3.5">Rows</th>
                <th className="text-left px-4 py-3.5">Brands</th>
                <th className="text-left px-4 py-3.5">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-sky-500/5 transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium">{row.file_name}</td>
                  <td className="px-4 py-3.5 text-muted-foreground uppercase text-xs tracking-wider">
                    {row.file_type}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider font-semibold ${
                        STATUS_BADGE[row.status] ?? 'text-muted-foreground'
                      }`}
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                    {row.row_count ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                    {row.brand_count ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
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
