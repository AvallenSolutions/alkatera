'use client';

/**
 * Pulse -- CSRD/ESRS gap list widget.
 *
 * Reads /api/pulse/csrd-gaps and renders the result grouped by severity.
 * Each row shows the ESRS reference, plain-English title, evidence and a
 * deep-link "Fix" button.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/lib/organizationContext';
import { cn } from '@/lib/utils';
import type { GapResult, GapSeverity } from '@/lib/pulse/csrd-gaps';

interface ApiPayload {
  ok: boolean;
  generated_at: string;
  summary: { critical: number; warning: number; ok: number };
  results: GapResult[];
}

const SEVERITY_RANK: Record<GapSeverity, number> = { critical: 0, warning: 1, ok: 2 };

const CATEGORY_LABEL: Record<string, string> = {
  environmental: 'Environment',
  social: 'Social',
  governance: 'Governance',
  general: 'General',
};

export function CsrdGapsWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOk, setShowOk] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/csrd-gaps?organization_id=${currentOrganization.id}`,
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

  const sorted = (data?.results ?? [])
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const visible = showOk ? sorted : sorted.filter(r => r.severity !== 'ok');
  const total = data?.results.length ?? 0;
  const covered = data?.summary.ok ?? 0;
  const coveragePct = total === 0 ? 0 : Math.round((covered / total) * 100);

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col p-0">
        <header className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-slate-50 to-white px-5 py-4 dark:from-slate-900/60 dark:to-slate-900">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[#ccff00]/15 p-2">
              <ClipboardList className="h-4 w-4 text-[#ccff00]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                CSRD readiness
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ESRS disclosure points evaluated against your live data.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {coveragePct}<span className="text-sm text-muted-foreground">%</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {covered}/{total} covered
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !data || total === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Could not evaluate CSRD readiness right now.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-2 text-[11px]">
              <SeverityChip count={data.summary.critical} severity="critical" />
              <SeverityChip count={data.summary.warning} severity="warning" />
              <SeverityChip count={data.summary.ok} severity="ok" />
              <button
                type="button"
                onClick={() => setShowOk(s => !s)}
                className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                {showOk ? 'Hide covered' : 'Show all'}
              </button>
            </div>

            <ul className="divide-y divide-border/60">
              {visible.length === 0 ? (
                <li className="px-5 py-6 text-sm text-muted-foreground">
                  No outstanding gaps. Tap "Show all" to see covered disclosures.
                </li>
              ) : (
                visible.map(gap => <GapRow key={gap.id} gap={gap} />)
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityChip({ count, severity }: { count: number; severity: GapSeverity }) {
  const styles =
    severity === 'critical'
      ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
      : severity === 'warning'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  const label =
    severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Covered';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
        styles,
      )}
    >
      <span className="tabular-nums">{count}</span>
      {label}
    </span>
  );
}

function GapRow({ gap }: { gap: GapResult }) {
  const Icon =
    gap.severity === 'ok'
      ? CheckCircle2
      : gap.severity === 'warning'
        ? AlertTriangle
        : AlertTriangle;
  const iconColour =
    gap.severity === 'ok'
      ? 'text-emerald-500'
      : gap.severity === 'warning'
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColour)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{gap.title}</p>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {gap.esrs_ref}
          </Badge>
          <Badge variant="secondary" className="text-[10px] tracking-wider">
            {CATEGORY_LABEL[gap.category] ?? gap.category}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{gap.evidence}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">{gap.why}</p>
      </div>
      {gap.severity !== 'ok' && (
        <Button asChild size="sm" variant="ghost" className="shrink-0 self-center text-xs">
          <Link href={gap.fix_href}>
            {gap.fix_label ?? 'Fix now'}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      )}
    </li>
  );
}
