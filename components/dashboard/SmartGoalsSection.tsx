'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Goal {
  title: string;
  current: number;
  target: number;
  unit: string;
  targetYear: string;
  percentage: number;
  color: 'lime' | 'cyan' | 'emerald';
}

interface SmartGoalsSectionProps {
  goals: Goal[];
  className?: string;
}

const colorMap = {
  lime: 'neon-lime' as const,
  cyan: 'neon-cyan' as const,
  emerald: 'neon-emerald' as const,
};

export function SmartGoalsSection({ goals, className }: SmartGoalsSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-semibold">Smart Goals</h2>
        <Link
          href="/reports"
          className="text-sm font-medium text-neon-lime hover:underline transition-all"
        >
          VIEW ALL
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal, index) => (
          <Card key={index} className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-base leading-tight pr-2">{goal.title}</h3>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {goal.targetYear}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1 text-sm text-muted-foreground font-data">
                <span className="font-semibold text-foreground">
                  {goal.current.toLocaleString()}
                </span>
                <span>/</span>
                <span>{goal.target.toLocaleString()}</span>
                <span>{goal.unit}</span>
              </div>

              <div className="space-y-2">
                <Progress
                  value={goal.percentage}
                  indicatorColor={goal.color}
                  className="h-2.5"
                />
                <div className="flex justify-end">
                  <span className={cn('text-lg font-bold font-data', {
                    'text-neon-lime': goal.color === 'lime',
                    'text-neon-cyan': goal.color === 'cyan',
                    'text-neon-emerald': goal.color === 'emerald',
                  })}>
                    {goal.percentage}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
