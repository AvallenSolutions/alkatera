'use client';

/**
 * Pulse -- Regulatory exposure.
 *
 * Headline £ exposure to UK ETS, CBAM, Plastic Packaging Tax and Packaging EPR.
 * Each line explains its basis and links to where to refine the input data.
 * Lines calculated from default / zero assumptions show a "needs data" pill.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Info, Loader2, Scale } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RegulatoryLine {
  id: string;
  label: string;
  annual_cost_gbp: number;
  basis: string;
  source: string;
  fix_href: string;
  assumed: boolean;
}

interface ApiPayload {
  ok: boolean;
  total_annual_gbp: number;
  lines: RegulatoryLine[];
  inputs: {
    annual_tonnes_co2e: number;
    plastic_packaging_tonnes: number;
    plastic_recycled_share: number;
  };
}

export function RegulatoryExposureWidget() {
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
          `/api/pulse/regulatory-exposure?organization_id=${currentOrganization.id}`,
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
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Scale className="h-3 w-3 text-[#ccff00]" />
            Regulatory exposure
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-foreground">
            UK ETS, CBAM, Plastic Tax, Packaging EPR
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Annual £ liability under the live regimes hitting drinks businesses
            right now. Fill in the gaps to sharpen the numbers.
          </p>
        </header>

        {loading && (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-4">
              <p className="text-xs text-muted-foreground">
                Estimated total regulatory cost, trailing 12 months
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground">
                {formatGbp(data.total_annual_gbp)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                across {data.lines.filter(l => l.annual_cost_gbp > 0).length} active
                regime{data.lines.filter(l => l.annual_cost_gbp > 0).length === 1 ? '' : 's'}
              </p>
            </div>

            <ul className="space-y-2">
              {data.lines.map(line => (
                <RegulatoryLineEl key={line.id} line={line} />
              ))}
            </ul>

            <p className="text-[10px] text-muted-foreground/70">
              Rates published by HMRC / Defra / EU. Reviewed quarterly; refreshed
              on{' '}
              <Link
                href="/pulse/settings/shadow-prices/"
                className="text-[#ccff00] hover:underline"
              >
                the Prices page
              </Link>
              . "Needs data" lines use default zero inputs; fill in packaging
              tonnage, CBAM scope or free allocation to sharpen the estimate.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RegulatoryLineEl({ line }: { line: RegulatoryLine }) {
  const hasCost = line.annual_cost_gbp > 0;
  return (
    <li
      className={cn(
        'rounded-md border p-3',
        hasCost ? 'border-border/60 bg-card/30' : 'border-dashed border-border/40 bg-muted/10',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{line.label}</span>
          {line.assumed && (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              <Info className="h-2.5 w-2.5" />
              Needs data
            </span>
          )}
        </div>
        <span
          className={cn(
            'text-base font-semibold tabular-nums',
            hasCost ? 'text-foreground' : 'text-muted-foreground/60',
          )}
        >
          {formatGbp(line.annual_cost_gbp)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{line.basis}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70">
        <span>{line.source}</span>
        {line.assumed && (
          <Link
            href={line.fix_href}
            className="inline-flex items-center gap-0.5 text-[#ccff00] hover:underline"
          >
            Add data <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
    </li>
  );
}

function formatGbp(v: number): string {
  if (v === 0) return '—';
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
    maximumFractionDigits: 0,
  });
}
