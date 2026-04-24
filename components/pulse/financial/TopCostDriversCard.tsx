'use client';

/**
 * Pulse Financial -- Top cost drivers.
 *
 * Three views toggled via a tab strip:
 *   - By line item   (the biggest single (category × facility) combinations)
 *   - By category    (electricity, gas, water etc.)
 *   - By facility    (which sites cost the most)
 *
 * Each view ranks contributors by trailing-12-month £ cost. The line-item view
 * is the default because it's the most actionable -- "the boiler at Brewhouse 2
 * is your single biggest line item".
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CategoryRow {
  category: string;
  label: string;
  gbp: number;
  pct_of_total: number;
}
interface FacilityRow {
  facility_id: string;
  facility_name: string;
  gbp: number;
  pct_of_total: number;
}
interface LineItemRow {
  category: string;
  category_label: string;
  facility_id: string;
  facility_name: string;
  gbp: number;
  pct_of_total: number;
}
interface ApiPayload {
  ok: boolean;
  total_gbp: number;
  by_category: CategoryRow[];
  by_facility: FacilityRow[];
  top_line_items: LineItemRow[];
}

type View = 'line_items' | 'category' | 'facility';

export function TopCostDriversCard() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('line_items');

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/cost-drivers?organization_id=${currentOrganization.id}&days=365`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setData(json as ApiPayload);
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
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top cost drivers
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              Where the money is going
            </h3>
          </div>
          <div className="flex rounded-md border border-border/60 bg-card/40 p-0.5 text-[11px]">
            {(
              [
                { id: 'line_items', label: 'Line items' },
                { id: 'category', label: 'Category' },
                { id: 'facility', label: 'Facility' },
              ] as Array<{ id: View; label: string }>
            ).map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={cn(
                  'rounded px-2.5 py-1 transition',
                  view === t.id
                    ? 'bg-[#ccff00] text-black'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && data.total_gbp === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            No facility activity in the last 12 months yet -- as you log emissions
            and water entries, the cost-driver ranking populates here.
          </p>
        )}

        {!loading && data && data.total_gbp > 0 && (
          <>
            {view === 'line_items' && (
              <RankList
                rows={data.top_line_items.map(r => ({
                  key: `${r.category}|${r.facility_id}`,
                  primary: `${r.category_label} · ${r.facility_name}`,
                  secondary: null,
                  gbp: r.gbp,
                  pct: r.pct_of_total,
                }))}
              />
            )}
            {view === 'category' && (
              <RankList
                rows={data.by_category.map(r => ({
                  key: r.category,
                  primary: r.label,
                  secondary: null,
                  gbp: r.gbp,
                  pct: r.pct_of_total,
                }))}
              />
            )}
            {view === 'facility' && (
              <RankList
                rows={data.by_facility.map(r => ({
                  key: r.facility_id,
                  primary: r.facility_name,
                  secondary: null,
                  gbp: r.gbp,
                  pct: r.pct_of_total,
                }))}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RankList({
  rows,
}: {
  rows: Array<{
    key: string;
    primary: string;
    secondary: string | null;
    gbp: number;
    pct: number;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No data in this view yet.</p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={r.key}
          className="flex items-center gap-3 rounded-md border border-border/40 bg-card/30 p-2.5"
        >
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{r.primary}</p>
            {r.secondary && (
              <p className="truncate text-[10px] text-muted-foreground">{r.secondary}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatGbp(r.gbp)}
            </span>
            <div className="flex h-1 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-[#ccff00]"
                style={{ width: `${Math.min(100, r.pct)}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {r.pct.toFixed(0)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  });
}
