"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'stable';

interface TrendIndicatorProps {
  value: number;
  direction?: TrendDirection;
  positiveDirection?: 'up' | 'down';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showValue?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  variant?: 'default' | 'badge' | 'minimal';
}

const sizeConfig = {
  xs: { iconSize: 'h-3 w-3', textSize: 'text-xs' },
  sm: { iconSize: 'h-3.5 w-3.5', textSize: 'text-sm' },
  md: { iconSize: 'h-4 w-4', textSize: 'text-base' },
  lg: { iconSize: 'h-5 w-5', textSize: 'text-lg' },
};

export function TrendIndicator({
  value,
  direction,
  positiveDirection = 'down',
  size = 'sm',
  showIcon = true,
  showValue = true,
  prefix = '',
  suffix = '%',
  className,
  variant = 'default',
}: TrendIndicatorProps) {
  const actualDirection = direction || (value > 0 ? 'up' : value < 0 ? 'down' : 'stable');

  const isPositive = actualDirection === positiveDirection ||
    (actualDirection === 'stable');

  const config = sizeConfig[size];

  const Icon = variant === 'minimal'
    ? (actualDirection === 'up' ? ArrowUp : actualDirection === 'down' ? ArrowDown : Minus)
    : (actualDirection === 'up' ? TrendingUp : actualDirection === 'down' ? TrendingDown : Minus);

  const colorClass = actualDirection === 'stable'
    ? 'text-gray-500'
    : isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  if (variant === 'badge') {
    const bgClass = actualDirection === 'stable'
      ? 'bg-gray-100 dark:bg-gray-800'
      : isPositive
        ? 'bg-green-100 dark:bg-green-900/30'
        : 'bg-red-100 dark:bg-red-900/30';

    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        bgClass,
        colorClass,
        config.textSize,
        'font-medium',
        className
      )}>
        {showIcon && <Icon className={config.iconSize} />}
        {showValue && (
          <span className="tabular-nums">
            {prefix}{value > 0 ? '+' : ''}{value}{suffix}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5',
      colorClass,
      config.textSize,
      'font-medium',
      className
    )}>
      {showIcon && <Icon className={config.iconSize} />}
      {showValue && (
        <span className="tabular-nums">
          {prefix}{value > 0 ? '+' : ''}{value}{suffix}
        </span>
      )}
    </span>
  );
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color,
  showArea = true,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const trend = data[data.length - 1] - data[0];
  const strokeColor = color || (trend >= 0 ? '#10b981' : '#ef4444');

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(' ');

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {showArea && (
        <polygon
          points={areaPoints}
          fill={strokeColor}
          fillOpacity={0.1}
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        r={2.5}
        fill={strokeColor}
      />
    </svg>
  );
}
