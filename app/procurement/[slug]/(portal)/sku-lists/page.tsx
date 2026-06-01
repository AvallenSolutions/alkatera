import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Upload, Inbox, FileSpreadsheet } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/procurement/layout/page-header';
import type { ProcurementSkuList } from '@/types/procurement';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  complete: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  processing: 'text-amber-700 border-amber-200 bg-amber-50',
  mapping: 'text-brand-primary border-brand-primary/30 bg-brand-primary/10',
  pending: 'text-muted-foreground border-border bg-muted/30',
  error: 'text-destructive border-destructive/30 bg-destructive/10',
};

export default async function ProcurementSkuListsPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: org } = await supabase
    .from('procurement_organizations')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!org) return null;
  const orgId = (org as { id: string }).id;

  const { data: lists } = (await supabase
    .from('procurement_sku_lists')
    .select('*')
    .eq('procurement_org_id', orgId)
    .order('created_at', { ascending: false })) as { data: ProcurementSkuList[] | null };

  return (
    <div className="space-y-8">
      <PageHeader
        pill="SKU lists"
        pillIcon={FileSpreadsheet}
        title="SKU lists"
        subtitle="Upload your procurement portfolio. Each row's distributor channel routes the SKU to the correct supplier tenant and triggers the sustainability data flow."
        action={
          <Button
            asChild
            className="bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold h-10 px-5 shadow-sm"
          >
            <Link href={`/procurement/${params.slug}/sku-lists/upload`}>
              <Upload className="h-4 w-4 mr-2" /> Upload SKU list
            </Link>
          </Button>
        }
      />

      {!lists || lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 px-8 flex flex-col items-center text-center gap-3">
          <div className="rounded-2xl bg-brand-primary/10 border border-brand-primary/20 p-4">
            <Inbox className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No uploads yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              CSV / XLSX / PDF with at minimum brand name, product name and a distributor
              channel column. Aliases like "Hallgarten & Novum" auto-resolve.
            </p>
          </div>
          <Button
            asChild
            className="bg-brand-primary hover:bg-brand-strong text-brand-on font-semibold mt-2"
          >
            <Link href={`/procurement/${params.slug}/sku-lists/upload`}>
              <Upload className="h-4 w-4 mr-2" /> Upload your first SKU list
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  File
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Type
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Status
                </th>
                <th className="text-right px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Rows
                </th>
                <th className="text-right px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Brands
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Channel split
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody>
              {lists.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-4 font-medium text-foreground">{row.file_name}</td>
                  <td className="px-5 py-4 text-muted-foreground uppercase text-[11px] tracking-wider">
                    {row.file_type}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
                        STATUS_BADGE[row.status] ?? 'text-muted-foreground border-border'
                      }`}
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right text-muted-foreground tabular-nums">
                    {row.row_count ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right text-muted-foreground tabular-nums">
                    {row.brand_count ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-[11px] text-muted-foreground">
                    {row.channel_summary
                      ? Object.entries(row.channel_summary)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-[11px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
