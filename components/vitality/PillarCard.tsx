"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import type { WorkingTone } from '@/components/studio/theme';
import { TrendIndicator } from '@/components/shared/TrendIndicator';
import { ScoreExplainer } from './ScoreExplainer';

export type PillarType = 'climate' | 'water' | 'circularity' | 'waste' | 'nature';

interface PillarCardProps {
  pillar: PillarType;
  score: number | null;
  value?: string;
  unit?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  benchmark?: {
    platform_average?: number;
    category_average?: number;
    category_name?: string;
    /** 75th percentile of the cohort — never one organisation's score. */
    top_quartile?: number;
    /** How many organisations the figures above are drawn from. */
    cohort_count?: number;
  };
  expanded?: boolean;
  onToggle?: () => void;
  /** Hide the methodology explainer popover (its copy is company-LCA specific). */
  showExplainer?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Pillar name and its one-line description. No colour, no icon, no emoji. */
const PILLAR_META: Record<PillarType, { name: string; description: string }> = {
  climate: { name: 'Climate', description: 'GHG emissions and carbon footprint' },
  water: { name: 'Water', description: 'Water consumption and scarcity impact' },
  circularity: { name: 'Circularity', description: 'Waste management and circular economy' },
  waste: { name: 'Waste', description: 'Food and dry waste sent off site' },
  nature: { name: 'Nature', description: 'Land use and biodiversity impact' },
};

/** Working-tone status derived from the 0-100 score. Chip, not a pill. */
function statusFor(score: number | null): { tone: WorkingTone; label: string } {
  if (score === null) return { tone: 'quiet', label: 'Awaiting data' };
  if (score >= 70) return { tone: 'good', label: 'On track' };
  if (score >= 50) return { tone: 'attention', label: 'Monitor' };
  return { tone: 'stale', label: 'Action needed' };
}

/**
 * A pillar on paper: a mono eyebrow, the score as a big honest number over
 * a mono label, a working-tone chip for status, and the deep-dive revealed
 * beneath a hairline when opened. No gradient tint, no icon-square, no
 * ring-glow, no traffic-light pill.
 */
export function PillarCard({
  pillar,
  score,
  value,
  unit,
  trend,
  trendDirection,
  benchmark,
  expanded = false,
  onToggle,
  showExplainer = true,
  children,
  className,
}: PillarCardProps) {
  const meta = PILLAR_META[pillar];
  const status = statusFor(score);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[6px] border border-border bg-card transition-colors duration-200 ease-studio',
        className,
      )}
    >
      <button
        onClick={onToggle}
        className="w-full p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-room-accent"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Eyebrow>{meta.name}</Eyebrow>
            {showExplainer && pillar !== 'waste' && (
              <ScoreExplainer
                scoreType={pillar}
                currentScore={score}
                benchmark={benchmark}
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            )}
          </div>
          <StateChip tone={status.tone}>{status.label}</StateChip>
        </div>

        <p className="mt-1.5 text-sm text-muted-foreground">{meta.description}</p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="flex items-end gap-8">
            <BigNumber
              value={score === null ? '--' : score}
              label="Vitality"
            />
            {value !== undefined && (
              <BigNumber value={value} label={unit ?? ''} />
            )}
            {trend !== undefined && trendDirection && (
              <TrendIndicator
                value={trend}
                direction={trendDirection}
                positiveDirection="down"
                variant="minimal"
                size="sm"
              />
            )}
          </div>

          {onToggle && (
            <span className="shrink-0 text-muted-foreground">
              {expanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </span>
          )}
        </div>
      </button>

      {expanded && children && (
        <div className="border-t border-border">
          <div className="p-5">{children}</div>
        </div>
      )}
    </div>
  );
}

interface PillarGridProps {
  children: React.ReactNode;
  className?: string;
}

export function PillarGrid({ children, className }: PillarGridProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {children}
    </div>
  );
}

interface PerformanceSummaryProps {
  strengths: Array<{ text: string }>;
  improvements: Array<{ text: string; priority?: 'high' | 'medium' }>;
  className?: string;
}

/** A quiet list of facts under a mono eyebrow, each with a working-tone chip. */
function SummaryColumn({
  eyebrow,
  rows,
  empty,
}: {
  eyebrow: string;
  rows: Array<{ tone: WorkingTone; chip: string; text: string }>;
  empty: string;
}) {
  return (
    <div>
      <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
      {rows.length === 0 ? (
        <p className="py-2.5 text-sm italic text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row, index) => (
            <li key={index} className="flex items-baseline gap-3 py-2.5">
              <StateChip tone={row.tone} className="shrink-0 pt-0.5">
                {row.chip}
              </StateChip>
              <span className="text-sm text-foreground">{row.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Strengths and areas for improvement as two quiet fact lists. Hairline
 * rows, working-tone chips, no saturated cards, no glyph headers, no HIGH
 * pills.
 */
export function PerformanceSummary({
  strengths,
  improvements,
  className,
}: PerformanceSummaryProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2', className)}>
      <SummaryColumn
        eyebrow="Strengths"
        empty="Add more data to identify strengths"
        rows={strengths.map((item) => ({ tone: 'good', chip: 'Good', text: item.text }))}
      />
      <SummaryColumn
        eyebrow="Areas for improvement"
        empty="No critical improvements identified"
        rows={improvements.map((item) => ({
          tone: item.priority === 'high' ? 'stale' : 'attention',
          chip: item.priority === 'high' ? 'Priority' : 'Attention',
          text: item.text,
        }))}
      />
    </div>
  );
}
