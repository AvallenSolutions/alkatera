'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
  trend: number;
  progress: number;
  color: 'lime' | 'cyan' | 'purple' | 'emerald';
  className?: string;
}

const colorMap = {
  lime: {
    icon: 'text-neon-lime',
    badge: 'neon-lime' as const,
    progress: 'lime' as const,
  },
  cyan: {
    icon: 'text-neon-cyan',
    badge: 'neon-cyan' as const,
    progress: 'cyan' as const,
  },
  purple: {
    icon: 'text-neon-purple',
    badge: 'neon-purple' as const,
    progress: 'purple' as const,
  },
  emerald: {
    icon: 'text-neon-emerald',
    badge: 'neon-emerald' as const,
    progress: 'emerald' as const,
  },
};

export function KPICard({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  progress,
  color,
  className,
}: KPICardProps) {
  const isPositiveTrend = trend < 0;
  const TrendIcon = isPositiveTrend ? TrendingDown : TrendingUp;
  const colors = colorMap[color];

  return (
    <Card className={cn('p-6 border-border hover:border-border/80 transition-all duration-200', className)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Icon className={cn('h-5 w-5', colors.icon)} />
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {label}
            </p>
          </div>
          <Badge variant={colors.badge} className="gap-1">
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(trend)}%</span>
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-data tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            <span className="text-sm text-muted-foreground font-data">{unit}</span>
          </div>
        </div>

        <Progress value={progress} indicatorColor={colors.progress} className="h-1" />
      </div>
    </Card>
  );
}
