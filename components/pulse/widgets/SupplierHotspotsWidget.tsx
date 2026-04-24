'use client';

/**
 * Pulse -- Supplier & Scope 3 hotspot widget.
 *
 * Surfaces the org's biggest supply-chain emission contributors so the user
 * can see "top 5 suppliers = 73% of Scope 3" at a glance and click through
 * to engage them. Reads from /api/pulse/supplier-hotspots which rolls up
 * product_carbon_footprint_materials.impact_climate to supplier + category.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, Loader2, Truck } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SupplierRow {
  supplier_id: string;
  supplier_name: string;
  total_kg_co2e: number;
  total_t_co2e: number;
  line_count: number;
  example_products: string[];
  pct_of_attributed: number;
  cumulative_pct_of_attributed: number;
}

interface CategoryRow {
  category: string;
  total_kg_co2e: number;
  total_t_co2e: number;
  pct_of_total: number;
}

interface ApiPayload {
  ok: boolean;
  totals: {
    total_kg_co2e: number;
    total_t_co2e: number;
    supplier_attributed_kg_co2e: number;
    supplier_attributed_t_co2e: number;
    supplier_coverage_pct: number;
    product_count: number;
  };
  by_supplier: SupplierRow[];
  by_category: CategoryRow[];
  empty_reason?: string;
}

const CATEGORY_META: Record<string, { label: string; Icon: typeof Boxes }> = {
  ingredients: { label: 'Ingredients & raw materials', Icon: Boxes },
  packaging: { label: 'Packaging', Icon: Boxes },
  transport: { label: 'Inbound transport', Icon: Truck },
};

export function SupplierHotspotsWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pulse/supplier-hotspots?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? 'Failed to load supplier hotspots');
        } else {
          setData(json as ApiPayload);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-5">
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Scope 3 hotspots
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Where your supply-chain emissions sit
            </h3>
          </div>
          <Link
            href="/suppliers"
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            All suppliers <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            {data.totals.product_count === 0 || data.by_supplier.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                {data.empty_reason ??
                  'No supplier-attributed Scope 3 yet. Link your bill-of-materials items to suppliers in the LCA wizard so emissions can be traced upstream.'}
              </p>
            ) : (
              <>
                <Headline totals={data.totals} suppliers={data.by_supplier} />
                <CategorySplit categories={data.by_category} />
                <SupplierList suppliers={data.by_supplier} />
                <p className="text-[10px] text-muted-foreground/70">
                  Aggregated across {data.totals.product_count} completed product LCAs.
                  Supplier coverage: {data.totals.supplier_coverage_pct.toFixed(0)}% of bill-of-materials emissions are linked to a supplier.
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Headline({
  totals,
  suppliers,
}: {
  totals: ApiPayload['totals'];
  suppliers: SupplierRow[];
}) {
  // Find the smallest N for which top N >= 50% of attributed.
  const top5Pct = suppliers.slice(0, 5).reduce((s, r) => s + r.pct_of_attributed, 0);
  const concentration =
    top5Pct >= 80
      ? { tone: 'text-red-500', label: 'Highly concentrated' }
      : top5Pct >= 50
        ? { tone: 'text-amber-500', label: 'Moderately concentrated' }
        : { tone: 'text-emerald-500', label: 'Well diversified' };

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <p className="text-xs text-muted-foreground">
        Your top {Math.min(5, suppliers.length)} suppliers account for
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
        {top5Pct.toFixed(0)}%
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          of supplier-attributed Scope 3
        </span>
      </p>
      <p className={cn('mt-1.5 text-xs font-medium', concentration.tone)}>
        {concentration.label}
        <span className="ml-2 text-muted-foreground">
          · {totals.supplier_attributed_t_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t CO₂e attributed
        </span>
      </p>
    </div>
  );
}

function CategorySplit({ categories }: { categories: CategoryRow[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        By upstream category
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {categories.map(c => (
          <div
            key={c.category}
            className={cn(
              c.category === 'ingredients' && 'bg-[#ccff00]',
              c.category === 'packaging' && 'bg-amber-500',
              c.category === 'transport' && 'bg-sky-500',
              !['ingredients', 'packaging', 'transport'].includes(c.category) && 'bg-slate-400',
            )}
            style={{ width: `${c.pct_of_total}%` }}
            title={`${c.category}: ${c.pct_of_total.toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {categories.map(c => {
          const meta = CATEGORY_META[c.category];
          const Icon = meta?.Icon ?? Boxes;
          return (
            <div key={c.category} className="flex items-center gap-1.5 text-[11px]">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground">
                {meta?.label ?? c.category}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {c.total_t_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t
                ({c.pct_of_total.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplierList({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Top contributing suppliers
      </p>
      <ul className="space-y-1.5">
        {suppliers.map((s, i) => (
          <li
            key={s.supplier_id}
            className="flex items-center gap-3 rounded-md border border-border/40 bg-card/30 p-2"
          >
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/suppliers/${s.supplier_id}`}
                className="block truncate text-sm text-foreground hover:text-[#ccff00]"
              >
                {s.supplier_name}
              </Link>
              {s.example_products.length > 0 && (
                <p className="truncate text-[10px] text-muted-foreground/70">
                  {s.example_products.join(' · ')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {s.total_t_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t
              </span>
              <div className="flex h-1 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-[#ccff00]"
                  style={{ width: `${Math.min(100, s.pct_of_attributed)}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {s.pct_of_attributed.toFixed(0)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
