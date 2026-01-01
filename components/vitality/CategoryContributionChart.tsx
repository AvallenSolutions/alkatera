'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoryData {
  id: string | number;
  name: string;
  value: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  dataQuality?: 'primary' | 'secondary' | 'estimated' | 'missing';
  color?: string;
  onClick?: () => void;
}

interface CategoryContributionChartProps {
  categories: CategoryData[];
  title?: string;
  subtitle?: string;
  unit?: string;
  showPercentages?: boolean;
  showTrends?: boolean;
  showDataQuality?: boolean;
  maxCategories?: number;
  orientation?: 'horizontal' | 'vertical';
  colorScheme?: 'default' | 'scope3' | 'gradient';
  onCategoryClick?: (category: CategoryData) => void;
  className?: string;
}

const SCOPE3_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
];

const GRADIENT_COLORS = [
  'bg-gradient-to-r from-emerald-400 to-teal-500',
  'bg-gradient-to-r from-cyan-400 to-blue-500',
  'bg-gradient-to-r from-blue-400 to-indigo-500',
  'bg-gradient-to-r from-indigo-400 to-violet-500',
  'bg-gradient-to-r from-violet-400 to-fuchsia-500',
  'bg-gradient-to-r from-fuchsia-400 to-pink-500',
  'bg-gradient-to-r from-pink-400 to-rose-500',
  'bg-gradient-to-r from-rose-400 to-orange-500',
  'bg-gradient-to-r from-orange-400 to-amber-500',
  'bg-gradient-to-r from-amber-400 to-yellow-500',
];

export function CategoryContributionChart({
  categories,
  title,
  subtitle,
  unit = 'kg CO₂e',
  showPercentages = true,
  showTrends = false,
  showDataQuality = true,
  maxCategories,
  orientation = 'vertical',
  colorScheme = 'scope3',
  onCategoryClick,
  className,
}: CategoryContributionChartProps) {
  const displayCategories = maxCategories ? categories.slice(0, maxCategories) : categories;
  const total = categories.reduce((sum, cat) => sum + cat.value, 0);
  const hasOther = maxCategories && categories.length > maxCategories;
  const otherTotal = hasOther
    ? categories.slice(maxCategories).reduce((sum, cat) => sum + cat.value, 0)
    : 0;

  const getColor = (index: number): string => {
    if (colorScheme === 'gradient') {
      return GRADIENT_COLORS[index % GRADIENT_COLORS.length];
    }
    return SCOPE3_COLORS[index % SCOPE3_COLORS.length];
  };

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(1);
  };

  const TrendIndicator = ({ trend, value }: { trend?: string; value?: number }) => {
    if (!trend) return null;
    const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const color =
      trend === 'down' ? 'text-green-600' : trend === 'up' ? 'text-red-600' : 'text-slate-500';
    return (
      <span className={cn('flex items-center gap-0.5 text-xs', color)}>
        <Icon className="h-3 w-3" />
        {value !== undefined && <span>{Math.abs(value).toFixed(0)}%</span>}
      </span>
    );
  };

  const DataQualityIndicator = ({ quality }: { quality?: string }) => {
    if (!quality) return null;
    const config: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
      primary: { icon: CheckCircle2, color: 'text-green-600', label: 'Primary data' },
      secondary: { icon: CheckCircle2, color: 'text-blue-600', label: 'Secondary data' },
      estimated: { icon: AlertCircle, color: 'text-amber-600', label: 'Estimated' },
      missing: { icon: AlertCircle, color: 'text-red-600', label: 'Missing data' },
    };
    const conf = config[quality] || config.estimated;
    const Icon = conf.icon;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Icon className={cn('h-3.5 w-3.5', conf.color)} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{conf.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (orientation === 'horizontal') {
    return (
      <Card className={className}>
        {(title || subtitle) && (
          <CardHeader className="pb-2">
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          <div className="flex h-8 rounded-lg overflow-hidden">
            {displayCategories.map((cat, idx) => {
              const width = total > 0 ? (cat.value / total) * 100 : 0;
              if (width < 0.5) return null;
              return (
                <TooltipProvider key={cat.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'h-full transition-all hover:opacity-80 cursor-pointer',
                          cat.color || getColor(idx)
                        )}
                        style={{ width: `${width}%` }}
                        onClick={() => {
                          cat.onClick?.();
                          onCategoryClick?.(cat);
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className="font-semibold">{cat.name}</p>
                        <p>
                          {formatValue(cat.value)} {unit} ({cat.percentage.toFixed(1)}%)
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
            {hasOther && otherTotal > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full bg-slate-300 dark:bg-slate-600 transition-all hover:opacity-80"
                      style={{ width: `${(otherTotal / total) * 100}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-semibold">Other categories</p>
                      <p>
                        {formatValue(otherTotal)} {unit} ({((otherTotal / total) * 100).toFixed(1)}
                        %)
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {displayCategories.map((cat, idx) => (
              <div
                key={cat.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors',
                  cat.onClick || onCategoryClick ? 'cursor-pointer' : ''
                )}
                onClick={() => {
                  cat.onClick?.();
                  onCategoryClick?.(cat);
                }}
              >
                <div className={cn('w-3 h-3 rounded-sm flex-shrink-0', cat.color || getColor(idx))} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {showPercentages ? `${cat.percentage.toFixed(1)}%` : formatValue(cat.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      )}

      {displayCategories.map((cat, idx) => {
        const percentage = total > 0 ? (cat.value / total) * 100 : 0;
        const isClickable = cat.onClick || onCategoryClick;

        return (
          <div
            key={cat.id}
            className={cn(
              'group',
              isClickable && 'cursor-pointer'
            )}
            onClick={() => {
              cat.onClick?.();
              onCategoryClick?.(cat);
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', cat.color || getColor(idx))} />
                <span className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                  {cat.name}
                </span>
                {showDataQuality && <DataQualityIndicator quality={cat.dataQuality} />}
                {showTrends && <TrendIndicator trend={cat.trend} value={cat.trendValue} />}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {formatValue(cat.value)}
                </span>
                {showPercentages && (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {percentage.toFixed(1)}%
                  </Badge>
                )}
                {isClickable && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  cat.color || getColor(idx),
                  isClickable && 'group-hover:opacity-80'
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}

      {hasOther && otherTotal > 0 && (
        <div className="group">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Other ({categories.length - (maxCategories || 0)} categories)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-slate-600">{formatValue(otherTotal)}</span>
              {showPercentages && (
                <Badge variant="outline" className="text-xs tabular-nums">
                  {((otherTotal / total) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-400"
              style={{ width: `${(otherTotal / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total</span>
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {formatValue(total)} {unit}
        </span>
      </div>
    </div>
  );
}
