"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Leaf, Droplets, Recycle, TreePine, Zap } from 'lucide-react';

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

const categoryConfig: Record<ImpactCategory, {
  icon: typeof Leaf;
  emoji: string;
  color: string;
  bgColor: string;
  activeColor: string;
}> = {
  climate: {
    icon: Leaf,
    emoji: '🌍',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    activeColor: 'ring-emerald-500',
  },
  water: {
    icon: Droplets,
    emoji: '💧',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    activeColor: 'ring-blue-500',
  },
  circularity: {
    icon: Recycle,
    emoji: '♻️',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    activeColor: 'ring-amber-500',
  },
  nature: {
    icon: TreePine,
    emoji: '🌱',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    activeColor: 'ring-green-500',
  },
  energy: {
    icon: Zap,
    emoji: '⚡',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    activeColor: 'ring-violet-500',
  },
};

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
      'flex flex-wrap gap-2',
      !compact && 'justify-center lg:justify-start',
      className
    )}>
      <TooltipProvider>
        {impacts.map((impact) => {
          const config = categoryConfig[impact.category];
          const Icon = config.icon;
          const isActive = activeCategory === impact.category;

          return (
            <Tooltip key={impact.category}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCategoryClick?.(impact.category)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200',
                    'border hover:shadow-md',
                    isActive
                      ? `${config.bgColor} border-transparent ring-2 ${config.activeColor}`
                      : 'bg-card border-border hover:border-muted-foreground/30',
                    onCategoryClick && 'cursor-pointer',
                    compact && 'px-2 py-1.5'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center rounded-lg',
                    compact ? 'w-6 h-6' : 'w-8 h-8',
                    config.bgColor
                  )}>
                    <Icon className={cn(
                      config.color,
                      compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                    )} />
                  </div>
                  <div className="text-left">
                    <p className={cn(
                      'font-semibold tabular-nums',
                      compact ? 'text-sm' : 'text-base'
                    )}>
                      {formatValue(impact.value, impact.unit)}
                      <span className={cn(
                        'font-normal text-muted-foreground ml-1',
                        compact ? 'text-xs' : 'text-sm'
                      )}>
                        {impact.unit}
                      </span>
                    </p>
                    {!compact && (
                      <p className="text-xs text-muted-foreground">
                        {impact.label}
                      </p>
                    )}
                  </div>
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
                  <p className="text-xs text-primary mt-1">
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
  const config = categoryConfig[category];
  const Icon = config.icon;

  const statusColors = {
    good: 'border-green-200 dark:border-green-800/50',
    warning: 'border-amber-200 dark:border-amber-800/50',
    critical: 'border-red-200 dark:border-red-800/50',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all duration-200',
        'bg-card hover:shadow-md hover:scale-[1.01]',
        status ? statusColors[status] : 'border-border',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl',
          config.bgColor
        )}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        {status && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            status === 'good' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            status === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            status === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          )}>
            {status === 'good' ? 'Good' : status === 'warning' ? 'Monitor' : 'Action'}
          </span>
        )}
      </div>

      <h3 className="font-medium text-sm text-muted-foreground">{label}</h3>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold tabular-nums">
          {formatValue(value, unit)}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {description}
        </p>
      )}

      {trend !== undefined && trendDirection && trendDirection !== 'stable' && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs font-medium',
          trendDirection === 'down' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        )}>
          <span>{trendDirection === 'down' ? '↓' : '↑'} {Math.abs(trend)}%</span>
          <span className="text-muted-foreground">vs previous</span>
        </div>
      )}
    </button>
  );
}
