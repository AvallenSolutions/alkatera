'use client';

/**
 * Pulse U5 -- CSRD readiness expanded view.
 *
 * Two layers:
 *   1. Quick-fix launcher: critical gaps surface as big call-to-action tiles
 *      at the top of the drill, so the user can jump straight to the thing
 *      that needs fixing without scrolling the full checklist.
 *   2. The existing CsrdGapsWidget with every disclosure point grouped by
 *      severity.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { CsrdGapsWidget } from '@/components/pulse/widgets/CsrdGapsWidget';
import { cn } from '@/lib/utils';

interface GapResult {
  id: string;
  esrs_ref: string;
  title: string;
  why: string;
  category: 'environmental' | 'social' | 'governance' | 'general';
  severity: 'critical' | 'warning' | 'ok';
  evidence: string;
  fix_href: string;
  fix_label?: string;
}

interface ApiPayload {
  summary: { critical: number; warning: number; ok: number };
  results: GapResult[];
}

const CATEGORY_LABEL: Record<GapResult['category'], string> = {
  environmental: 'Environmental',
  social: 'Social',
  governance: 'Governance',
  general: 'General',
};

export function CsrdGapsExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <CsrdGapsExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'csrd-gaps-expanded',
    title: 'ESRS checklist + quick fixers',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'csrd-gaps',
    render: renderer,
  });
  return null;
}

function CsrdGapsExpanded() {
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

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data && <QuickFixLauncher data={data} />}
      <CsrdGapsWidget />
    </div>
  );
}

function QuickFixLauncher({ data }: { data: ApiPayload }) {
  const critical = data.results.filter(g => g.severity === 'critical');
  const warning = data.results.filter(g => g.severity === 'warning');
  const ok = data.results.filter(g => g.severity === 'ok');
  const total = critical.length + warning.length + ok.length;

  if (total === 0) {
    return null;
  }

  // "All clear" state
  if (critical.length === 0 && warning.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          All ESRS disclosure points are covered by your current data.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ok.length} checks passing. Keep running the checklist before each
          reporting cycle.
        </p>
      </section>
    );
  }

  // Rank criticals first, then warnings. Cap at 6 for the dock.
  const featured = [...critical, ...warning].slice(0, 6);

  return (
    <section className="space-y-3">
      <header>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Quick-fix launcher
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Jump straight to the page that closes each disclosure gap. Focused
          on the highest-severity items today.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {featured.map(gap => (
          <QuickFixTile key={gap.id} gap={gap} />
        ))}
      </div>

      {critical.length + warning.length > featured.length && (
        <p className="text-xs text-muted-foreground">
          {critical.length + warning.length - featured.length} more gap
          {critical.length + warning.length - featured.length === 1 ? '' : 's'}{' '}
          below -- scroll through the full checklist.
        </p>
      )}
    </section>
  );
}

function QuickFixTile({ gap }: { gap: GapResult }) {
  const isCritical = gap.severity === 'critical';
  const Icon = isCritical ? AlertCircle : AlertTriangle;
  return (
    <Link
      href={gap.fix_href}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border p-4 transition hover:-translate-y-0.5',
        isCritical
          ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60 hover:bg-red-500/10'
          : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            'h-4 w-4',
            isCritical ? 'text-red-500' : 'text-amber-500',
          )}
        />
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider',
            isCritical ? 'text-red-500' : 'text-amber-500',
          )}
        >
          {isCritical ? 'Critical' : 'Warning'}
        </span>
        <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {gap.esrs_ref}
        </span>
        <span className="ml-auto rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          {CATEGORY_LABEL[gap.category]}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{gap.title}</p>
      <p className="text-[11px] text-muted-foreground">{gap.evidence}</p>
      <p className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#ccff00] group-hover:underline">
        {gap.fix_label ?? 'Open fixer'}
        <ArrowRight className="h-3 w-3" />
      </p>
    </Link>
  );
}
