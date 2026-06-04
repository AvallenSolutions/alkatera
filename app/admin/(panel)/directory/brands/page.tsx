import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Upload, Search, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { RescoreAllButton } from '@/components/admin/directory/rescore-all-button';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  source?: string;
  verification?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = getSupabaseAdminClient() as unknown as SupabaseClient;
  const q = (searchParams.q ?? '').trim();
  const source = searchParams.source ?? '';
  const verification = searchParams.verification ?? '';
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('brand_directory')
    .select(
      'id, name, category, country_of_origin, alkatera_org_id, sustainability_score, completeness_score, discovered_via, discovery_opt_out, verification_status, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });
  if (q) query = query.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`);
  if (source) query = query.eq('discovered_via', source);
  if (verification) query = query.eq('verification_status', verification);
  query = query.range(from, to);

  const { data: brands, count } = await query;

  type Row = {
    id: string;
    name: string;
    category: string | null;
    country_of_origin: string | null;
    alkatera_org_id: string | null;
    sustainability_score: number | null;
    completeness_score: number | null;
    discovered_via: string;
    discovery_opt_out: boolean;
    verification_status: string;
    created_at: string;
  };
  const rows = (brands ?? []) as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {(count ?? 0).toLocaleString()} canonical brands in the directory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RescoreAllButton />
          <Button asChild className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold">
            <Link href="/admin/directory/brands/upload">
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/admin/directory/brands">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search brand name"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
          />
        </div>
        <select
          name="verification"
          defaultValue={verification}
          className="px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm"
        >
          <option value="">All statuses</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending review</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          name="source"
          defaultValue={source}
          className="px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm"
        >
          <option value="">All sources</option>
          <option value="sku_upload">SKU upload</option>
          <option value="alkatera_signup">alkatera signup</option>
          <option value="manual">Manual (admin)</option>
          <option value="phase1_backfill">Phase-1 backfill</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center">
          <div className="text-sm font-semibold mb-1">No brands match those filters</div>
          <div className="text-xs text-muted-foreground">
            Try a broader search or{' '}
            <Link href="/admin/directory/brands/upload" className="text-neon-lime hover:underline">
              upload your first CSV
            </Link>
            .
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-4 py-2">Country</th>
                <th className="text-right px-4 py-2">Score</th>
                <th className="text-right px-4 py-2">Complete</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/directory/brands/${b.id}`}
                      className="hover:text-neon-lime"
                    >
                      {b.name}
                      {b.alkatera_org_id && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-300">
                          on alkatera
                        </span>
                      )}
                      {b.discovery_opt_out && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">
                          hidden
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <VerificationBadge status={b.verification_status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{b.category ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.country_of_origin ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {b.sustainability_score != null ? Math.round(b.sustainability_score) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {b.completeness_score != null ? `${Math.round(b.completeness_score)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground">
                    {b.discovered_via.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <PageLink page={page - 1} disabled={page <= 1} q={q} source={source} verification={verification} label="Previous" />
        <span>
          Page {page} of {totalPages}
        </span>
        <PageLink page={page + 1} disabled={page >= totalPages} q={q} source={source} verification={verification} label="Next" />
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  q,
  source,
  verification,
  label,
}: {
  page: number;
  disabled: boolean;
  q: string;
  source: string;
  verification: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="px-3 py-1.5 rounded border border-border/40 text-muted-foreground/40">
        {label}
      </span>
    );
  }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (source) params.set('source', source);
  if (verification) params.set('verification', verification);
  params.set('page', String(page));
  return (
    <Link
      href={`/admin/directory/brands?${params.toString()}`}
      className="px-3 py-1.5 rounded border border-border/60 hover:border-neon-lime hover:text-foreground"
    >
      {label}
    </Link>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const style =
    status === 'verified'
      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
      : status === 'rejected'
        ? 'bg-destructive/15 border-destructive/30 text-destructive'
        : 'bg-amber-500/15 border-amber-400/30 text-amber-300';
  const label = status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Pending';
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 ${style}`}
    >
      {label}
    </span>
  );
}
