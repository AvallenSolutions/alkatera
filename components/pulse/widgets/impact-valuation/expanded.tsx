'use client';

/**
 * Pulse Financial -- Impact Valuation expanded drill.
 *
 * Summary view:
 *   - Net impact headline + confidence + data coverage
 *   - Four-capital breakdown with per-category totals
 *   - Link to the full-page report for narratives + methodology
 *
 * We don't try to replicate the whole 660-line report in the drill overlay;
 * the sidebar methodology content and Claude-generated narratives deserve a
 * dedicated page. The drill is the "quick read" surface.
 */

import { useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  Leaf,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { useImpactValuation } from '@/hooks/data/useImpactValuation';
import { cn } from '@/lib/utils';

export function ImpactValuationExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(
    () => <ImpactValuationExpanded />,
    [],
  );
  useRegisterDrillSlot({
    id: 'impact-valuation-expanded',
    title: 'Monetised impact across four capitals',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'impact-valuation',
    render: renderer,
  });
  return null;
}

function ImpactValuationExpanded() {
  const { result, isLoading, error } = useImpactValuation();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
        {error}
      </p>
    );
  }

  if (!result) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Impact Valuation hasn&apos;t been calculated yet for this org.
        </p>
        <Link
          href="/pulse/financial/impact-valuation"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#ccff00]/40 bg-[#ccff00]/10 px-3 py-1.5 text-xs font-medium text-[#ccff00] hover:bg-[#ccff00]/20"
        >
          Open the full report to run it
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Headline */}
      <section className="grid gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Net monetised impact
          </p>
          <p
            className={cn(
              'mt-1 text-4xl font-semibold tabular-nums',
              result.net_impact >= 0 ? 'text-emerald-500' : 'text-red-500',
            )}
          >
            {result.net_impact >= 0 ? '+' : '-'}
            {formatGbp(Math.abs(result.net_impact))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reporting year {result.reporting_year}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-500">
            <TrendingUp className="h-3 w-3" />
            Positive
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-500">
            {formatGbp(result.positive_total)}
          </p>
          <p className="text-xs text-muted-foreground">
            benefits created
          </p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-red-500">
            <TrendingDown className="h-3 w-3" />
            Negative
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-500">
            {formatGbp(result.negative_total)}
          </p>
          <p className="text-xs text-muted-foreground">
            externalities generated
          </p>
        </div>
      </section>

      {/* Four capitals */}
      <section className="grid gap-3 sm:grid-cols-2">
        <CapitalBlock
          icon={Leaf}
          title="Natural capital"
          subtitle="Carbon, water, land, waste"
          total={result.natural.total}
          items={result.natural.items}
          tone="natural"
        />
        <CapitalBlock
          icon={Users}
          title="Human capital"
          subtitle="Living wage, training, wellbeing"
          total={result.human.total}
          items={result.human.items}
          tone="human"
        />
        <CapitalBlock
          icon={Heart}
          title="Social capital"
          subtitle="Volunteering, giving, local supply"
          total={result.social.total}
          items={result.social.items}
          tone="social"
        />
        <CapitalBlock
          icon={ShieldCheck}
          title="Governance capital"
          subtitle="Governance quality"
          total={result.governance.total}
          items={result.governance.items}
          tone="governance"
        />
      </section>

      <p className="text-[11px] text-muted-foreground">
        Data coverage:{' '}
        <span className="font-medium text-foreground">
          {Math.round(result.data_coverage * 100)}%
        </span>
        {' · '}Confidence:{' '}
        <span className="font-medium text-foreground capitalize">
          {result.confidence_level}
        </span>
        . Metrics use published shadow prices and proxy values -- open the full
        report for the methodology and per-metric sources.
      </p>

      <Link
        href="/pulse/financial/impact-valuation"
        className="inline-flex items-center gap-1.5 rounded-md border border-[#ccff00]/40 bg-[#ccff00]/10 px-3 py-2 text-xs font-medium text-[#ccff00] hover:bg-[#ccff00]/20"
      >
        Open the full Impact Valuation report
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

interface CapitalBlockProps {
  icon: typeof Leaf;
  title: string;
  subtitle: string;
  total: number;
  items: Array<{ label: string; value: number; unit_label?: string }>;
  tone: 'natural' | 'human' | 'social' | 'governance';
}

function CapitalBlock({ icon: Icon, title, subtitle, total, items }: CapitalBlockProps) {
  const signClass =
    total > 0 ? 'text-emerald-500' : total < 0 ? 'text-red-500' : 'text-foreground';
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#ccff00]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <p className={cn('whitespace-nowrap text-lg font-semibold tabular-nums', signClass)}>
          {total >= 0 ? '+' : '-'}
          {formatGbp(Math.abs(total))}
        </p>
      </header>
      {items.length > 0 && (
        <ul className="space-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          {items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 tabular-nums">
              <span className="truncate">{item.label}</span>
              <span
                className={cn(
                  item.value > 0
                    ? 'text-emerald-500'
                    : item.value < 0
                      ? 'text-red-500'
                      : 'text-muted-foreground',
                )}
              >
                {item.value >= 0 ? '+' : '-'}
                {formatGbp(Math.abs(item.value))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return abs.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return abs.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
