'use client';

/**
 * B Corp "Your next steps" — turns the readiness snapshot into a short, ordered
 * action list (mandatory-with-data first, then mandatory, then quick confirms,
 * then gaps) so users always know the next most useful thing to do, plus the
 * two honest readiness figures (submit-readiness vs whole programme).
 */

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CertificationReadiness } from '@/lib/certifications/scoring';
import { bucketLabel, topActions, type NextActionBucket } from '@/lib/certifications/roadmap';

const BUCKET_STYLE: Record<NextActionBucket, string> = {
  confirm: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  mandatory: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  gap: 'border-border/60 bg-muted/40 text-muted-foreground',
};

export function RoadmapCard({
  readiness,
  onOpen,
}: {
  readiness: CertificationReadiness;
  onOpen: (requirementId: string) => void;
}) {
  const actions = topActions(readiness, 5);
  const totalRemaining = readiness.requirementStatuses.filter(
    (rs) => rs.status === 'in_progress' || rs.status === 'not_started',
  ).length;

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Your next steps</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The most useful things to do next, easiest and most urgent first.
            </p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-lg font-semibold tabular-nums text-foreground">{readiness.year0ReadinessPct}%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready to submit</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">{readiness.programmeReadinessPct}%</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Whole programme</p>
            </div>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Nothing outstanding for your current year. You are on track.
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => (
              <li
                key={a.requirementId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', BUCKET_STYLE[a.bucket])}>
                      {bucketLabel(a.bucket)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onOpen(a.requirementId)}>
                  Open <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {totalRemaining > actions.length && (
          <p className="text-[11px] text-muted-foreground">
            {totalRemaining - actions.length} more requirement{totalRemaining - actions.length === 1 ? '' : 's'} to work through below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
