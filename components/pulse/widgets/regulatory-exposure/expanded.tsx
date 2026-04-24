'use client';

/**
 * Pulse U5 -- Regulatory exposure, expanded view.
 *
 * Three sections:
 *   1. Existing RegulatoryExposureWidget (totals + per-regime breakdown)
 *   2. Compliance calendar: next 12 months of filing deadlines from the
 *      curated lib/pulse/regulatory-deadlines.ts reference.
 *   3. What-if mitigations: toggle common abatement interventions and see
 *      how the regulatory exposure changes.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import {
  expandDeadlines,
  type DeadlineRegime,
  type UpcomingDeadline,
} from '@/lib/pulse/regulatory-deadlines';
import { RegulatoryExposureWidget } from '@/components/pulse/widgets/RegulatoryExposureWidget';
import { cn } from '@/lib/utils';

export function RegulatoryExposureExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <RegulatoryExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'regulatory-exposure-expanded',
    title: 'Per-regime detail + calendar',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'regulatory-exposure',
    render: renderer,
  });
  return null;
}

function RegulatoryExpanded() {
  return (
    <div className="space-y-8">
      <RegulatoryExposureWidget />
      <ComplianceCalendar />
      <WhatIfMitigations />
    </div>
  );
}

const REGIME_COLOURS: Record<DeadlineRegime, string> = {
  uk_ets: 'bg-[#ccff00]/15 text-[#ccff00] border-[#ccff00]/40',
  cbam: 'bg-sky-500/15 text-sky-500 border-sky-500/40',
  plastic_tax: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
  epr: 'bg-purple-500/15 text-purple-500 border-purple-500/40',
  csrd: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40',
  streamlined: 'bg-rose-500/15 text-rose-500 border-rose-500/40',
};

function ComplianceCalendar() {
  const deadlines = useMemo(() => expandDeadlines(), []);
  const overdue = deadlines.filter(d => d.days_away < 0);
  const soon = deadlines.filter(d => d.days_away >= 0 && d.days_away <= 60);
  const later = deadlines.filter(d => d.days_away > 60);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-[#ccff00]" />
        Compliance calendar (next 12 months)
      </h3>
      <p className="text-xs text-muted-foreground">
        Reference dates for the UK / EU regimes most drinks businesses sit
        under. Update alongside the shadow-price engine as legislation evolves.
      </p>

      {overdue.length > 0 && (
        <DeadlineGroup
          label="Overdue"
          icon={AlertTriangle}
          items={overdue}
          tone="bad"
        />
      )}
      <DeadlineGroup
        label="Due in the next 60 days"
        icon={AlertTriangle}
        items={soon}
        tone="warn"
      />
      <DeadlineGroup
        label="Later this year"
        icon={CheckCircle2}
        items={later}
        tone="neutral"
      />
    </section>
  );
}

function DeadlineGroup({
  label,
  icon: Icon,
  items,
  tone,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: UpcomingDeadline[];
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === 'bad'
      ? 'text-red-500'
      : tone === 'warn'
        ? 'text-amber-500'
        : tone === 'good'
          ? 'text-emerald-500'
          : 'text-muted-foreground';
  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider',
          toneClass,
        )}
      >
        <Icon className="h-3 w-3" />
        {label} · {items.length}
      </p>
      <ul className="space-y-1.5">
        {items.map(d => (
          <li
            key={d.id}
            className="flex items-baseline justify-between gap-3 rounded-md border border-border/40 bg-card/30 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                    REGIME_COLOURS[d.regime],
                  )}
                >
                  {d.regime_label}
                </span>
                <p className="text-sm font-medium text-foreground">{d.title}</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{d.description}</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                Source: {d.source}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 whitespace-nowrap">
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {d.due_date}
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium tabular-nums',
                  d.days_away < 0
                    ? 'text-red-500'
                    : d.days_away <= 30
                      ? 'text-amber-500'
                      : 'text-muted-foreground',
                )}
              >
                {d.days_away < 0
                  ? `${Math.abs(d.days_away)}d overdue`
                  : d.days_away === 0
                    ? 'today'
                    : `in ${d.days_away}d`}
              </span>
              <Link
                href={d.action_href}
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#ccff00] hover:underline"
              >
                Act <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// What-if mitigations ---------------------------------------------------------

interface Mitigation {
  id: string;
  label: string;
  description: string;
  /** Reduction applied to the affected regime, 0-1. */
  reductionByRegime: Partial<Record<DeadlineRegime, number>>;
}

const MITIGATIONS: Mitigation[] = [
  {
    id: 'renewables_q2',
    label: 'Switch electricity to renewable PPA by Q2',
    description: 'Eliminates Scope 2 emissions and most UK ETS scope at import sites.',
    reductionByRegime: { uk_ets: 0.35 },
  },
  {
    id: 'heat_pumps',
    label: 'Install heat pumps at main site',
    description:
      'Replaces ~70% of gas use. Reduces UK ETS shortfall and (indirectly) CBAM exposure on backup imports.',
    reductionByRegime: { uk_ets: 0.25 },
  },
  {
    id: 'lightweight_glass',
    label: 'Lightweight 330ml glass (-12% mass)',
    description:
      'Reduces packaging tonnage across PPT and EPR in proportion to the mass reduction.',
    reductionByRegime: { plastic_tax: 0.0, epr: 0.12 },
  },
  {
    id: 'recycled_content',
    label: 'Move plastic packaging to 30%+ recycled',
    description:
      'Removes PPT liability on reformulated lines (PPT exempts >=30% recycled content).',
    reductionByRegime: { plastic_tax: 0.6 },
  },
  {
    id: 'cbam_dedup',
    label: 'Switch to UK-only glass bottles',
    description:
      'Removes CBAM liability on glass imports. Procurement cost implications not modelled here.',
    reductionByRegime: { cbam: 0.9 },
  },
];

function WhatIfMitigations() {
  const [active, setActive] = useState<Set<string>>(new Set());

  // Fetch regulatory exposure once to seed the reduction maths.
  const [baselineByRegime, setBaselineByRegime] = useState<
    Record<string, number>
  >({});
  const [loaded, setLoaded] = useState(false);

  useMemo(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pulse/regulatory-exposure');
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const byRegime: Record<string, number> = {};
        for (const line of json?.lines ?? []) {
          byRegime[line.id] = Number(line.annual_cost_gbp ?? 0);
        }
        setBaselineByRegime(byRegime);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Fire once on mount -- this is a useMemo used as an IIFE-with-cleanup;
    // the empty dep list gates the fetch even under HMR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBaseline = Object.values(baselineByRegime).reduce((s, v) => s + v, 0);

  // Combine active mitigations: each mitigation multiplies the remaining
  // exposure in its affected regimes. Compound independently across regimes.
  const remainingByRegime = useMemo(() => {
    const out: Record<string, number> = { ...baselineByRegime };
    Array.from(active).forEach(id => {
      const m = MITIGATIONS.find(x => x.id === id);
      if (!m) return;
      for (const [regime, reduction] of Object.entries(m.reductionByRegime)) {
        const current = out[regime] ?? 0;
        out[regime] = Math.max(0, current * (1 - (reduction ?? 0)));
      }
    });
    return out;
  }, [active, baselineByRegime]);

  const totalRemaining = Object.values(remainingByRegime).reduce((s, v) => s + v, 0);
  const avoided = totalBaseline - totalRemaining;

  const toggle = (id: string) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!loaded) return null;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Wrench className="h-4 w-4 text-[#ccff00]" />
        What-if mitigations
      </h3>
      <p className="text-xs text-muted-foreground">
        Toggle interventions to see how your annual regulatory exposure
        changes. Reductions are applied to the regime(s) each mitigation
        affects and compound across regimes.
      </p>

      <div className="grid gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Baseline
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatGbp(totalBaseline)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            After mitigations
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatGbp(totalRemaining)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-emerald-500">
          <p className="text-[10px] uppercase tracking-wider opacity-80">
            Avoided
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatGbp(avoided)}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {MITIGATIONS.map(m => {
          const on = active.has(m.id);
          return (
            <li
              key={m.id}
              className={cn(
                'cursor-pointer rounded-md border p-3 transition',
                on
                  ? 'border-[#ccff00]/50 bg-[#ccff00]/5'
                  : 'border-border/40 bg-card/30 hover:border-border',
              )}
              onClick={() => toggle(m.id)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                    on
                      ? 'border-[#ccff00] bg-[#ccff00] text-black'
                      : 'border-border/60',
                  )}
                >
                  {on && <CheckCircle2 className="h-3 w-3" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{m.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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
