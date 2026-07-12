"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';

export type ImpactCategory = 'climate' | 'water' | 'circularity' | 'nature' | 'energy';

interface ImpactItem {
  category: ImpactCategory;
  value: number;
  unit: string;
  label: string;
  tooltip?: string;
  status?: 'good' | 'warning' | 'critical';
}

interface QuickImpactBarProps {
  impacts: ImpactItem[];
  activeCategory?: ImpactCategory;
  onCategoryClick?: (category: ImpactCategory) => void;
  className?: string;
  compact?: boolean;
}

function formatValue(value: number, unit: string): string {
  if (value == null) return '0';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  if (value < 0.01 && value > 0) {
    return value.toExponential(1);
  }
  return value.toFixed(value < 10 ? 2 : 1);
}

export function QuickImpactBar({
  impacts,
  activeCategory,
  onCategoryClick,
  className,
  compact = false,
}: QuickImpactBarProps) {
  return (
    <div className={cn(
      'flex flex-wrap gap-x-8 gap-y-4',
      !compact && 'justify-center lg:justify-start',
      className
    )}>
      <TooltipProvider>
        {impacts.map((impact) => {
          const isActive = activeCategory === impact.category;

          return (
            <Tooltip key={impact.category}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCategoryClick?.(impact.category)}
                  className={cn(
                    'text-left transition-opacity duration-200',
                    !isActive && activeCategory ? 'opacity-60 hover:opacity-100' : 'hover:opacity-80',
                    onCategoryClick && 'cursor-pointer'
                  )}
                >
                  <BigNumber
                    size="panel"
                    tone={isActive ? 'room' : 'ink'}
                    value={
                      <>
                        {formatValue(impact.value, impact.unit)}
                        <span className="ml-1 text-sm font-normal text-studio-dim">
                          {impact.unit}
                        </span>
                      </>
                    }
                    label={impact.label.toUpperCase()}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{impact.label}</p>
                {impact.tooltip && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {impact.tooltip}
                  </p>
                )}
                {onCategoryClick && (
                  <p className="text-xs text-room-accent mt-1">
                    Click to view details
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}

interface ImpactSummaryCardProps {
  category: ImpactCategory;
  value: number;
  unit: string;
  label: string;
  description?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  onClick?: () => void;
  className?: string;
}

export function ImpactSummaryCard({
  category,
  value,
  unit,
  label,
  description,
  trend,
  trendDirection,
  status,
  onClick,
  className,
}: ImpactSummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-[6px] border border-studio-hairline bg-studio-cream p-5',
        'transition-colors duration-200 hover:border-studio-ink/30',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <Eyebrow tone="dim">{label}</Eyebrow>
        {status && (
          <StateChip tone={status === 'good' ? 'good' : status === 'warning' ? 'attention' : 'stale'}>
            {status === 'good' ? 'Good' : status === 'warning' ? 'Monitor' : 'Action'}
          </StateChip>
        )}
      </div>

      <BigNumber
        size="panel"
        value={
          <>
            {formatValue(value, unit)}
            <span className="ml-1 text-sm font-normal text-studio-dim">{unit}</span>
          </>
        }
        label={unit.toUpperCase()}
      />

      {description && (
        <p className="text-xs text-studio-dim mt-3 line-clamp-2">
          {description}
        </p>
      )}

      {trend !== undefined && trendDirection && trendDirection !== 'stable' && (
        <div className="mt-3">
          <StateChip tone={trendDirection === 'down' ? 'good' : 'stale'}>
            {Math.abs(trend)}% vs previous
          </StateChip>
        </div>
      )}
    </button>
  );
}
