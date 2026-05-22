import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Upload, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const q = (searchParams.q ?? '').trim();
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('product_directory')
    .select(
      'id, name, gtin, category, container_size_ml, container_format, abv, embodied_carbon_kgco2e, discovered_via, brand_directory_id, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });
  if (q) query = query.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`);
  query = query.range(from, to);

  const { data: products, count } = await query;
  type Row = {
    id: string;
    name: string;
    gtin: string | null;
    category: string | null;
    container_size_ml: number | null;
    container_format: string | null;
    abv: number | null;
    embodied_carbon_kgco2e: number | null;
    discovered_via: string;
    brand_directory_id: string;
    created_at: string;
  };
  const rows = (products ?? []) as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Hydrate brand names in one query.
  const brandIds = Array.from(new Set(rows.map((r) => r.brand_directory_id)));
  const brandNameById = new Map<string, string>();
  if (brandIds.length > 0) {
    const { data: brandRows } = await supabase
      .from('brand_directory')
      .select('id, name')
      .in('id', brandIds);
    for (const b of (brandRows ?? []) as Array<{ id: string; name: string }>) {
      brandNameById.set(b.id, b.name);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {(count ?? 0).toLocaleString()} canonical products in the directory.
          </p>
        </div>
        <Button asChild className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold">
          <Link href="/admin/directory/products/upload">
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/admin/directory/products">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search product name"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center">
          <div className="text-sm font-semibold mb-1">No products match those filters</div>
          <div className="text-xs text-muted-foreground">
            <Link
              href="/admin/directory/products/upload"
              className="text-neon-lime hover:underline"
            >
              Upload a products CSV
            </Link>{' '}
            to seed them.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="text-left px-4 py-2">Product</th>
                <th className="text-left px-4 py-2">Brand</th>
                <th className="text-left px-4 py-2">GTIN</th>
                <th className="text-left px-4 py-2">Size</th>
                <th className="text-right px-4 py-2">kgCO₂e</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/directory/products/${p.id}`}
                      className="hover:text-neon-lime"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    <Link
                      href={`/admin/directory/brands/${p.brand_directory_id}`}
                      className="hover:text-neon-lime"
                    >
                      {brandNameById.get(p.brand_directory_id) ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground tabular-nums">
                    {p.gtin ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.container_size_ml ? `${p.container_size_ml} ml` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {p.embodied_carbon_kgco2e != null
                      ? p.embodied_carbon_kgco2e.toFixed(2)
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground">
                    {p.discovered_via.replace(/_/g, ' ')}
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
        <PageLink page={page - 1} disabled={page <= 1} q={q} label="Previous" />
        <span>
          Page {page} of {totalPages}
        </span>
        <PageLink page={page + 1} disabled={page >= totalPages} q={q} label="Next" />
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  q,
  label,
}: {
  page: number;
  disabled: boolean;
  q: string;
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
  params.set('page', String(page));
  return (
    <Link
      href={`/admin/directory/products?${params.toString()}`}
      className="px-3 py-1.5 rounded border border-border/60 hover:border-neon-lime hover:text-foreground"
    >
      {label}
    </Link>
  );
}
