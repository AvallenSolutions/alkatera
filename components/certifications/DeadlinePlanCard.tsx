'use client';

/**
 * Deadline-driven plan for recertifying brands: a countdown to the 5-year
 * recertification deadline (and the ECGT marketing deadline for EU brands) plus
 * a backward-planned schedule of what must be done by when.
 */

import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CertificationReadiness } from '@/lib/certifications/scoring';
import { buildDeadlinePlan, recertDeadline } from '@/lib/certifications/deadline-plan';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function countdown(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'due today';
  if (days < 60) return `in ${days} days`;
  return `in about ${Math.round(days / 30)} months`;
}

export function DeadlinePlanCard({ readiness }: { readiness: CertificationReadiness }) {
  if (!readiness.certificationStartDate) return null;
  const deadlineIso = recertDeadline(readiness.certificationStartDate);
  if (!deadlineIso) return null;
  const plan = buildDeadlinePlan(deadlineIso);
  if (!plan) return null;

  return (
    <Card className={cn('border-border/60', plan.overdue && 'border-studio-stale/40')}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-studio-brick" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Recertification deadline</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your 5-year cycle ends on{' '}
              <span className="font-medium text-foreground">{formatDate(plan.deadline)}</span>{' '}
              <span className={cn(plan.overdue ? 'text-studio-stale' : 'text-muted-foreground')}>({countdown(plan.daysRemaining)})</span>.
            </p>
            {readiness.ecgtApplicable && (
              <p className="mt-1 text-xs text-studio-attention">
                You use B Corp status in EU marketing, so the ECGT (Empowering Consumers for the Green Transition) deadline also applies: keep your claims substantiated.
              </p>
            )}
          </div>
        </div>

        <ol className="space-y-2">
          {plan.milestones.map((m) => {
            const Icon = m.done ? CheckCircle2 : Circle;
            return (
              <li key={m.label} className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4 shrink-0', m.done ? 'text-studio-good' : 'text-muted-foreground/50')} />
                <span className={cn('flex-1 text-sm', m.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {m.label}
                </span>
                <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {formatDate(m.date)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
