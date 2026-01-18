"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VitalityRingProps {
  score: number | null;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  label?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  benchmark?: number;
  className?: string;
  animated?: boolean;
}

const sizeConfig = {
  sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' },
  md: { diameter: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-sm' },
  lg: { diameter: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-base' },
  xl: { diameter: 200, strokeWidth: 12, fontSize: 'text-4xl', labelSize: 'text-lg' },
};

function getScoreLabel(score: number): { label: string; colorClass: string } {
  if (score >= 85) return { label: 'EXCELLENT', colorClass: 'text-emerald-500' };
  if (score >= 70) return { label: 'GOOD', colorClass: 'text-green-500' };
  if (score >= 50) return { label: 'FAIR', colorClass: 'text-amber-500' };
  if (score >= 30) return { label: 'NEEDS WORK', colorClass: 'text-orange-500' };
  return { label: 'CRITICAL', colorClass: 'text-red-500' };
}

function getScoreColor(score: number): string {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function getGradientId(score: number): string {
  if (score >= 70) return 'greenGradient';
  if (score >= 50) return 'amberGradient';
  return 'redGradient';
}

export function VitalityRing({
  score,
  maxScore = 100,
  size = 'lg',
  showLabel = true,
  label,
  trend,
  trendDirection,
  benchmark,
  className,
  animated = true,
}: VitalityRingProps) {
  const config = sizeConfig[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Handle null score - show empty ring
  const isNoData = score === null;
  const actualScore = score ?? 0;
  const normalizedScore = Math.min(Math.max(actualScore, 0), maxScore);
  const progress = isNoData ? 0 : (normalizedScore / maxScore) * circumference;
  const dashOffset = circumference - progress;

  const { label: scoreLabel, colorClass } = isNoData
    ? { label: 'NO DATA', colorClass: 'text-gray-400' }
    : getScoreLabel(normalizedScore);
  const strokeColor = isNoData ? '#9ca3af' : getScoreColor(normalizedScore);

  const TrendIcon = trendDirection === 'up' ? TrendingUp :
                    trendDirection === 'down' ? TrendingDown : Minus;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.diameter, height: config.diameter }}>
        <svg
          width={config.diameter}
          height={config.diameter}
          className="transform -rotate-90"
        >
          <defs>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-gray-200 dark:text-gray-800"
          />

          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={`url(#${getGradientId(normalizedScore)})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference : dashOffset}
            filter="url(#glow)"
            className={cn(
              'transition-all duration-1000 ease-out',
              animated && 'animate-ring-progress'
            )}
            style={{
              '--ring-offset': dashOffset,
              strokeDashoffset: dashOffset,
            } as React.CSSProperties}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold tabular-nums', config.fontSize, isNoData && 'text-gray-400')}>
            {isNoData ? '--' : Math.round(normalizedScore)}
          </span>
          {showLabel && (
            <span className={cn('font-medium', config.labelSize, colorClass)}>
              {label || scoreLabel}
            </span>
          )}
        </div>
      </div>

      {(trend !== undefined || benchmark !== undefined) && (
        <div className="flex items-center gap-4 mt-2">
          {trend !== undefined && trendDirection && (
            <div className={cn(
              'flex items-center gap-1 text-sm',
              trendDirection === 'up' ? 'text-green-500' :
              trendDirection === 'down' ? 'text-red-500' : 'text-gray-500'
            )}>
              <TrendIcon className="h-4 w-4" />
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          )}

          {benchmark !== undefined && (
            <div className="text-sm text-muted-foreground">
              vs industry: {normalizedScore > benchmark ? (
                <span className="text-green-500">+{normalizedScore - benchmark} better</span>
              ) : normalizedScore < benchmark ? (
                <span className="text-red-500">{normalizedScore - benchmark} below</span>
              ) : (
                <span className="text-gray-500">average</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MiniVitalityRing({
  score,
  maxScore = 100,
  size = 60,
  strokeWidth = 5,
  className,
}: {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(Math.max(score, 0), maxScore);
  const progress = (normalizedScore / maxScore) * circumference;
  const dashOffset = circumference - progress;
  const strokeColor = getScoreColor(normalizedScore);

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">{Math.round(normalizedScore)}</span>
      </div>
    </div>
  );
}
