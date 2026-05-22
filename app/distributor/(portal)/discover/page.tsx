'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, Sparkles, Globe2, Tag, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DiscoverBrand {
  id: string;
  name: string;
  category: string | null;
  country_of_origin: string | null;
  on_alkatera: boolean;
  sustainability_score: number | null;
  score_tier: string | null;
  completeness_score: number | null;
  last_synced_at: string | null;
  listed_by_you: boolean;
  product_count: number;
  lca_product_count: number;
}

interface DiscoverResponse {
  brands: DiscoverBrand[];
  total: number;
  page: number;
  page_size: number;
}

const NONE = '__any__';

export default function DiscoverPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>(NONE);
  const [tier, setTier] = useState<string>(NONE);
  const [alkateraOnly, setAlkateraOnly] = useState(false);
  const [hasLca, setHasLca] = useState(false);
  const [sort, setSort] = useState<'score' | 'completeness' | 'name' | 'recent'>('score');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category !== NONE) params.set('category', category);
      if (tier !== NONE) params.set('tier', tier);
      if (alkateraOnly) params.set('alkatera_only', 'true');
      if (hasLca) params.set('has_lca', 'true');
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('page_size', '24');
      try {
        const res = await fetch(`/api/distributor/discover/brands?${params.toString()}`);
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as DiscoverResponse;
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const handle = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, category, tier, alkateraOnly, hasLca, sort, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Search className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              Industry directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Discover brands
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Search the canonical directory of drinks brands and add any of them to your
              portfolio. Sustainability data accumulated by previous distributors and direct
              alka<strong>tera</strong> brands is immediately available.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by brand name"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>
          <FilterSelect
            label="Category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={[
              { value: NONE, label: 'All categories' },
              { value: 'spirits', label: 'Spirits' },
              { value: 'wine', label: 'Wine' },
              { value: 'beer', label: 'Beer' },
              { value: 'non_alc', label: 'Non-alcoholic' },
            ]}
          />
          <FilterSelect
            label="Tier"
            value={tier}
            onChange={(v) => {
              setTier(v);
              setPage(1);
            }}
            options={[
              { value: NONE, label: 'Any tier' },
              { value: 'leader', label: 'Leader' },
              { value: 'progressing', label: 'Progressing' },
              { value: 'developing', label: 'Developing' },
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              { value: 'score', label: 'Sustainability score' },
              { value: 'completeness', label: 'Data completeness' },
              { value: 'recent', label: 'Recently updated' },
              { value: 'name', label: 'Name (A-Z)' },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <Checkbox
            checked={alkateraOnly}
            onChange={(v) => {
              setAlkateraOnly(v);
              setPage(1);
            }}
            label="alkatera-verified only"
          />
          <Checkbox
            checked={hasLca}
            onChange={(v) => {
              setHasLca(v);
              setPage(1);
            }}
            label="Has product LCA data"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="text-sm text-muted-foreground p-8 text-center">Searching the directory…</div>
      )}

      {data && data.brands.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center">
          <div className="text-sm font-semibold mb-1">No brands matched those filters</div>
          <div className="text-xs text-muted-foreground">
            Try a broader search or clear filters. New brands enter the directory each time a
            distributor uploads a portfolio.
          </div>
        </div>
      )}

      {data && data.brands.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground">
            {data.total.toLocaleString()} brand{data.total === 1 ? '' : 's'} found · page {data.page}{' '}
            of {totalPages}
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.brands.map((brand) => (
              <li key={brand.id}>
                <Link
                  href={`/distributor/discover/brands/${brand.id}`}
                  className="group block rounded-xl border border-border/60 bg-gradient-to-br from-card/60 via-card/40 to-card/40 p-4 space-y-3 hover:border-sky-400/60 hover:from-sky-500/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate group-hover:text-sky-200 transition-colors">
                        {brand.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {brand.category && (
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {brand.category}
                          </span>
                        )}
                        {brand.country_of_origin && (
                          <span className="inline-flex items-center gap-1">
                            <Globe2 className="h-3 w-3" />
                            {brand.country_of_origin}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-sky-300 transition-colors shrink-0 mt-0.5" />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {brand.on_alkatera && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-emerald-500/15 border-emerald-400/30 text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> on alkatera
                      </span>
                    )}
                    {brand.listed_by_you && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-foreground/10 border-border/60 text-foreground/80">
                        <CheckCircle2 className="h-3 w-3" /> Listed by you
                      </span>
                    )}
                    {brand.score_tier && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 ${tierStyle(
                          brand.score_tier,
                        )}`}
                      >
                        {brand.score_tier}
                      </span>
                    )}
                    {brand.lca_product_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 bg-sky-500/15 border-sky-400/30 text-sky-200">
                        <Sparkles className="h-3 w-3" />
                        {brand.lca_product_count} LCA
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <Stat
                      label="Score"
                      value={brand.sustainability_score != null ? Math.round(brand.sustainability_score) : '—'}
                    />
                    <Stat
                      label="Complete"
                      value={
                        brand.completeness_score != null
                          ? `${Math.round(brand.completeness_score)}%`
                          : '—'
                      }
                    />
                    <Stat label="Products" value={brand.product_count} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {data.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background/40 h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border/60 bg-background/40 text-sky-400 focus:ring-sky-400"
      />
      <span>{label}</span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function tierStyle(tier: string): string {
  switch (tier) {
    case 'leader':
      return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300';
    case 'progressing':
      return 'bg-sky-500/15 border-sky-400/30 text-sky-200';
    case 'developing':
      return 'bg-amber-500/15 border-amber-400/30 text-amber-300';
    default:
      return 'bg-foreground/10 border-border/60 text-foreground/80';
  }
}
