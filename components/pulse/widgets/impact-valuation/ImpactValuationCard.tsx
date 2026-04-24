'use client';

/**
 * Pulse Financial -- Impact Valuation compact card.
 *
 * Reuses the existing `useImpactValuation` hook to read the pre-calculated
 * cached figure. Headline: net monetised impact £. Status chip: confidence
 * band. Supporting visual: four-capital stacked bar (natural / human /
 * social / governance).
 *
 * Click opens the drill overlay, which renders a summary + link to the
 * full /pulse/financial/impact-valuation page for methodology + narratives.
 */

import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { useImpactValuation } from '@/hooks/data/useImpactValuation';
import { PulseCard } from '@/components/pulse/PulseCard';

const CAPITAL_COLOURS: Record<'natural' | 'human' | 'social' | 'governance', string> = {
  natural: '#ccff00',
  human: '#38bdf8',
  social: '#a78bfa',
  governance: '#f59e0b',
};

export function ImpactValuationCard() {
  const { openDrill } = useWidgetDrill();
  const { result, isLoading, error } = useImpactValuation();

  const net = result?.net_impact ?? null;
  const coverage = result ? Math.round(result.data_coverage * 100) : null;
  const confidence = result?.confidence_level ?? null;

  const status = confidence
    ? confidence === 'high'
      ? ({ tone: 'good' as const, label: 'High confidence' })
      : confidence === 'medium'
        ? ({ tone: 'warn' as const, label: 'Medium conf' })
        : ({ tone: 'neutral' as const, label: 'Low conf' })
    : null;

  // Four capital totals for the stacked bar. Use absolute values so the
  // visual shows magnitude; the headline sign tells net direction.
  const capitals = result
    ? [
        { key: 'natural' as const, value: Math.abs(result.natural.total) },
        { key: 'human' as const, value: Math.abs(result.human.total) },
        { key: 'social' as const, value: Math.abs(result.social.total) },
        { key: 'governance' as const, value: Math.abs(result.governance.total) },
      ]
    : [];
  const capitalTotal = capitals.reduce((s, c) => s + c.value, 0);

  return (
    <PulseCard
      icon={Sparkles}
      label="Impact valuation"
      headline={net !== null ? formatSignedGbp(net) : '—'}
      sub={net !== null ? 'net monetised impact' : 'Run calculation to populate'}
      status={status}
      footprint="2x1"
      loading={isLoading}
      error={error ?? undefined}
      onExpand={() => openDrill({ kind: 'widget', id: 'impact-valuation' })}
      footer={coverage !== null ? `${coverage}% data coverage · ${result?.reporting_year ?? ''}` : undefined}
    >
      {capitalTotal > 0 ? (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {capitals.map(c =>
              c.value > 0 ? (
                <div
                  key={c.key}
                  className="h-full"
                  style={{
                    backgroundColor: CAPITAL_COLOURS[c.key],
                    width: `${(c.value / capitalTotal) * 100}%`,
                  }}
                  title={`${labelFor(c.key)}: ${formatSignedGbp(getCapitalTotal(result!, c.key))}`}
                />
              ) : null,
            )}
          </div>
          {/* Positive vs negative split underneath */}
          {result && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                {formatGbpAbs(result.positive_total)} benefits
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                {formatGbpAbs(result.negative_total)} costs
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Awaiting calculation
        </div>
      )}
    </PulseCard>
  );
}

function getCapitalTotal(
  result: { natural: { total: number }; human: { total: number }; social: { total: number }; governance: { total: number } },
  key: 'natural' | 'human' | 'social' | 'governance',
): number {
  return result[key].total;
}

function labelFor(key: 'natural' | 'human' | 'social' | 'governance'): string {
  return key.charAt(0).toUpperCase() + key.slice(1) + ' capital';
}

function formatSignedGbp(v: number): string {
  const prefix = v > 0 ? '+' : v < 0 ? '-' : '';
  return prefix + formatGbpAbs(Math.abs(v));
}

function formatGbpAbs(v: number): string {
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
