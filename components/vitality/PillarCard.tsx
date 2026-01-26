"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MiniVitalityRing } from './VitalityRing';
import { TrendIndicator } from '@/components/shared/TrendIndicator';
import { ScoreExplainer } from './ScoreExplainer';
import {
  ChevronDown,
  ChevronUp,
  Leaf,
  Droplets,
  Recycle,
  TreePine,
  type LucideIcon
} from 'lucide-react';

export type PillarType = 'climate' | 'water' | 'circularity' | 'nature';

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
    top_performer?: number;
  };
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const pillarConfig: Record<PillarType, {
  name: string;
  icon: LucideIcon;
  emoji: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  iconBg: string;
}> = {
  climate: {
    name: 'Climate',
    icon: Leaf,
    emoji: '🌍',
    description: 'GHG emissions and carbon footprint',
    gradientFrom: 'from-emerald-50 dark:from-emerald-950/20',
    gradientTo: 'to-green-50/50 dark:to-green-950/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  },
  water: {
    name: 'Water',
    icon: Droplets,
    emoji: '💧',
    description: 'Water consumption and scarcity impact',
    gradientFrom: 'from-blue-50 dark:from-blue-950/20',
    gradientTo: 'to-cyan-50/50 dark:to-cyan-950/10',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  },
  circularity: {
    name: 'Circularity',
    icon: Recycle,
    emoji: '♻️',
    description: 'Waste management and circular economy',
    gradientFrom: 'from-amber-50 dark:from-amber-950/20',
    gradientTo: 'to-orange-50/50 dark:to-orange-950/10',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  },
  nature: {
    name: 'Nature',
    icon: TreePine,
    emoji: '🌱',
    description: 'Land use and biodiversity impact',
    gradientFrom: 'from-green-50 dark:from-green-950/20',
    gradientTo: 'to-lime-50/50 dark:to-lime-950/10',
    borderColor: 'border-green-200 dark:border-green-800/50',
    iconBg: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
  },
};

export function PillarCard({
  pillar,
  score,
  value,
  unit,
  trend,
  trendDirection,
  status,
  benchmark,
  expanded = false,
  onToggle,
  children,
  className,
}: PillarCardProps) {
  const config = pillarConfig[pillar];
  const Icon = config.icon;
  const hasData = score !== null;

  const statusLabel = !hasData ? 'Awaiting Data' :
                      score >= 70 ? 'On Track' :
                      score >= 50 ? 'Monitor' : 'Action Needed';

  return (
    <Card className={cn(
      'overflow-hidden border transition-all duration-300',
      `bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo}`,
      config.borderColor,
      expanded && 'ring-2 ring-offset-2 ring-offset-background',
      expanded && pillar === 'climate' && 'ring-emerald-500/50',
      expanded && pillar === 'water' && 'ring-blue-500/50',
      expanded && pillar === 'circularity' && 'ring-amber-500/50',
      expanded && pillar === 'nature' && 'ring-green-500/50',
      className
    )}>
      <button
        onClick={onToggle}
        className="w-full p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-xl p-2.5', config.iconBg)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.emoji}</span>
                <h3 className="font-semibold text-lg">{config.name}</h3>
                <ScoreExplainer
                  scoreType={pillar}
                  currentScore={score}
                  benchmark={benchmark}
                  className="hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasData ? (
              <MiniVitalityRing score={score} size={48} strokeWidth={4} />
            ) : (
              <div
                className="flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium"
                style={{ width: 48, height: 48 }}
              >
                --
              </div>
            )}
            {onToggle && (
              <div className="text-muted-foreground">
                {expanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {value !== undefined && (
              <div>
                <span className="text-2xl font-bold tabular-nums">{value}</span>
                {unit && (
                  <span className="text-sm text-muted-foreground ml-1">{unit}</span>
                )}
              </div>
            )}

            {trend !== undefined && trendDirection && (
              <TrendIndicator
                value={trend}
                direction={trendDirection}
                positiveDirection="down"
                variant="badge"
                size="sm"
              />
            )}
          </div>

          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            !hasData && 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
            hasData && score >= 70 && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            hasData && score >= 50 && score < 70 && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            hasData && score < 50 && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          )}>
            {statusLabel}
          </span>
        </div>
      </button>

      {expanded && children && (
        <div className="border-t border-inherit">
          <div className="p-4">
            {children}
          </div>
        </div>
      )}
    </Card>
  );
}

interface PillarGridProps {
  children: React.ReactNode;
  className?: string;
}

export function PillarGrid({ children, className }: PillarGridProps) {
  return (
    <div className={cn(
      'grid grid-cols-1 md:grid-cols-2 gap-4',
      className
    )}>
      {children}
    </div>
  );
}

interface PerformanceSummaryProps {
  strengths: Array<{ text: string; icon?: LucideIcon }>;
  improvements: Array<{ text: string; icon?: LucideIcon; priority?: 'high' | 'medium' }>;
  className?: string;
}

export function PerformanceSummary({
  strengths,
  improvements,
  className,
}: PerformanceSummaryProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      <Card className="p-4 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50">
        <h3 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-3">
          <span className="text-lg">✓</span>
          Strengths
        </h3>
        <ul className="space-y-2">
          {strengths.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-green-500 mt-0.5">•</span>
              <span className="text-green-800 dark:text-green-300">{item.text}</span>
            </li>
          ))}
          {strengths.length === 0 && (
            <li className="text-sm text-muted-foreground italic">
              Add more data to identify strengths
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
        <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3">
          <span className="text-lg">⚠</span>
          Areas for Improvement
        </h3>
        <ul className="space-y-2">
          {improvements.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className={cn(
                'mt-0.5',
                item.priority === 'high' ? 'text-red-500' : 'text-amber-500'
              )}>•</span>
              <span className="text-amber-800 dark:text-amber-300">{item.text}</span>
              {item.priority === 'high' && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded dark:bg-red-900/30 dark:text-red-400">
                  HIGH
                </span>
              )}
            </li>
          ))}
          {improvements.length === 0 && (
            <li className="text-sm text-muted-foreground italic">
              No critical improvements identified
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
