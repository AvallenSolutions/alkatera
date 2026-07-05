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
  if (score >= 85) return { label: 'EXCELLENT', colorClass: 'text-studio-good' };
  if (score >= 70) return { label: 'GOOD', colorClass: 'text-studio-good' };
  if (score >= 50) return { label: 'FAIR', colorClass: 'text-studio-attention' };
  if (score >= 30) return { label: 'NEEDS WORK', colorClass: 'text-studio-attention' };
  return { label: 'CRITICAL', colorClass: 'text-studio-stale' };
}

// Working tones from components/studio/theme.ts: good / attention / stale.
function getScoreColor(score: number): string {
  if (score >= 70) return '#047857';
  if (score >= 30) return '#B45309';
  return '#BE123C';
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
    ? { label: 'NO DATA', colorClass: 'text-studio-dim' }
    : getScoreLabel(normalizedScore);
  const strokeColor = isNoData ? '#6F6F68' : getScoreColor(normalizedScore);

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
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-studio-hairline"
          />

          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference : dashOffset}
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
          <span className={cn('font-bold tabular-nums', config.fontSize, isNoData && 'text-studio-dim')}>
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
              trendDirection === 'up' ? 'text-studio-good' :
              trendDirection === 'down' ? 'text-studio-stale' : 'text-studio-dim'
            )}>
              <TrendIcon className="h-4 w-4" />
              <span>{trend > 0 ? '+' : ''}{trend}%</span>
            </div>
          )}

          {benchmark !== undefined && (
            <div className="text-sm text-muted-foreground">
              vs industry: {normalizedScore > benchmark ? (
                <span className="text-studio-good">+{normalizedScore - benchmark} better</span>
              ) : normalizedScore < benchmark ? (
                <span className="text-studio-stale">{normalizedScore - benchmark} below</span>
              ) : (
                <span className="text-studio-dim">average</span>
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
          className="text-studio-hairline"
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
