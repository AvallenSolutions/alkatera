"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Leaf,
  Droplets,
  Recycle,
  TreePine,
  Zap,
  Users,
  Clock,
  Plus,
  type LucideIcon
} from 'lucide-react';
import Link from 'next/link';

export type RAGStatus = 'good' | 'warning' | 'critical' | 'neutral';

interface RAGStatusCardProps {
  title: string;
  status: RAGStatus;
  value?: string | number;
  unit?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  icon?: LucideIcon;
  category?: 'climate' | 'water' | 'waste' | 'nature' | 'energy' | 'suppliers';
  href?: string;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  loading?: boolean;
}

const statusConfig: Record<RAGStatus, {
  label: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  iconBgClass: string;
  BadgeIcon?: LucideIcon;
}> = {
  good: {
    label: 'On Track',
    bgClass: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    badgeClass: 'bg-green-500/20 text-green-600 dark:text-green-400',
    iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    BadgeIcon: TrendingUp,
  },
  warning: {
    label: 'Monitor',
    bgClass: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800/50',
    badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    BadgeIcon: Clock,
  },
  critical: {
    label: 'Action Needed',
    bgClass: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
    borderClass: 'border-red-200 dark:border-red-800/50',
    badgeClass: 'bg-red-500/20 text-red-600 dark:text-red-400',
    iconBgClass: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  },
  neutral: {
    label: 'Needs Data',
    bgClass: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30',
    borderClass: 'border-gray-200 dark:border-gray-800/50',
    badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    iconBgClass: 'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400',
    BadgeIcon: Clock,
  },
};

const categoryIcons: Record<string, LucideIcon> = {
  climate: Leaf,
  water: Droplets,
  waste: Recycle,
  nature: TreePine,
  energy: Zap,
  suppliers: Users,
};

export function RAGStatusCard({
  title,
  status,
  value,
  unit,
  trend,
  trendDirection,
  icon,
  category,
  href,
  onClick,
  className,
  compact = false,
  loading = false,
}: RAGStatusCardProps) {
  const config = statusConfig[loading ? 'neutral' : status];
  const Icon = icon || (category ? categoryIcons[category] : Leaf);

  // Show card outline with shimmer content while data is loading
  if (loading) {
    const shimmerClass = 'rounded-md bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer';
    return (
      <Card
        className={cn(
          'relative overflow-hidden border transition-all duration-200',
          statusConfig.neutral.bgClass,
          statusConfig.neutral.borderClass,
          compact ? 'p-3' : 'p-4',
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className={cn('rounded-xl p-2', statusConfig.neutral.iconBgClass)}>
            <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
          </div>
          <div className={cn(shimmerClass, 'h-6 w-20 rounded-full')} />
        </div>
        <div className={cn('mt-3', compact && 'mt-2')}>
          <h3 className={cn(
            'font-semibold text-gray-900 dark:text-gray-100',
            compact ? 'text-sm' : 'text-base'
          )}>
            {title}
          </h3>
          <div className={cn(shimmerClass, 'mt-1', compact ? 'h-6 w-20' : 'h-8 w-24')} />
        </div>
      </Card>
    );
  }

  const TrendIcon = trendDirection === 'up' ? TrendingUp :
                    trendDirection === 'down' ? TrendingDown : Minus;

  const trendIsPositive = (trendDirection === 'down' && category !== 'suppliers') ||
                          (trendDirection === 'up' && category === 'suppliers');

  const BadgeIcon = config.BadgeIcon;
  const isNeedsData = status === 'neutral';

  const content = (
    <Card
      className={cn(
        'relative overflow-hidden border transition-all duration-200',
        config.bgClass,
        config.borderClass,
        (href || onClick) && 'cursor-pointer hover:shadow-lg hover:scale-[1.02]',
        compact ? 'p-3' : 'p-4',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={cn('rounded-xl p-2', config.iconBgClass)}>
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        <span className={cn(
          'text-xs font-medium rounded-full px-2 py-1 flex items-center gap-1',
          config.badgeClass
        )}>
          {BadgeIcon && <BadgeIcon className="h-3 w-3" />}
          {config.label}
        </span>
      </div>

      <div className={cn('mt-3', compact && 'mt-2')}>
        <h3 className={cn(
          'font-semibold text-gray-900 dark:text-gray-100',
          compact ? 'text-sm' : 'text-base'
        )}>
          {title}
        </h3>

        {(value !== undefined || trend !== undefined) && (
          <div className="flex items-baseline gap-2 mt-1">
            {value !== undefined && (
              <span className={cn(
                'font-bold tabular-nums',
                compact ? 'text-xl' : 'text-2xl'
              )}>
                {typeof value === 'number' ? value.toLocaleString() : value}
                {unit && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {unit}
                  </span>
                )}
              </span>
            )}

            {trend !== undefined && trendDirection && trendDirection !== 'stable' && (
              <div className={cn(
                'flex items-center gap-0.5 text-sm font-medium',
                trendIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Start tracking CTA for empty state */}
        {isNeedsData && href && (
          <button className="mt-3 text-xs text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 font-medium flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Start tracking
          </button>
        )}
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export function RAGStatusCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
      className
    )}>
      {children}
    </div>
  );
}
