'use client';

/**
 * Pulse Financial -- Cost intensity card.
 *
 * Three intensity ratios that translate environmental cost into business-as-usual
 * units a CFO already tracks:
 *   - £ per £m revenue
 *   - £ per FTE
 *   - £ per unit produced
 *
 * Each ratio degrades to a "fix this" prompt when the denominator is missing.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';

interface RatioResult {
  value: number | null;
  unit: string;
  denominator: number;
  denominator_label: string;
  fix_href: string;
  missing_reason: string | null;
}

interface ApiPayload {
  ok: boolean;
  trailing_12_months_gbp: number;
  ratios: {
    per_m_revenue: RatioResult;
    per_fte: RatioResult;
    per_unit: RatioResult;
  };
}

export function CostIntensityCard() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/cost-intensity?organization_id=${currentOrganization.id}`,
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
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cost intensity
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-foreground">
            Cost per £1m sales, per person, per unit
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Your environmental cost measured against revenue, headcount and units
            made, so you can compare it fairly as the business grows.
          </p>
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading…</p>
          </div>
        )}

        {!loading && data && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Ratio label="Per £m revenue" ratio={data.ratios.per_m_revenue} />
            <Ratio label="Per employee" ratio={data.ratios.per_fte} />
            <Ratio label="Per unit produced" ratio={data.ratios.per_unit} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ratio({ label, ratio }: { label: string; ratio: RatioResult }) {
  if (ratio.value === null) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{ratio.missing_reason}</p>
        <Link
          href={ratio.fix_href}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-studio-forest hover:underline"
        >
          Add data <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {formatGbp(ratio.value)}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {ratio.denominator.toLocaleString('en-GB')} {ratio.denominator_label}
      </p>
    </div>
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
