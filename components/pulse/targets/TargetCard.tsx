'use client';

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS } from '@/lib/pulse/metric-keys';
import { forecastTrajectory } from '@/lib/pulse/forecast';
import { INITIATIVE_STATUSES } from '@/lib/pulse/initiative-status';
import type { Initiative, Target } from './types';

const PILL_STYLES: Record<string, string> = {
  on_track: 'bg-green-500/15 text-green-500',
  at_risk: 'bg-amber-500/15 text-amber-500',
  off_track: 'bg-red-500/15 text-red-500',
  unknown: 'bg-muted text-muted-foreground',
};

const PILL_LABELS: Record<string, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  unknown: 'Not enough data yet',
};

interface TargetCardProps {
  target: Target;
  history: { date: string; value: number }[];
  initiatives: Initiative[];
  onDelete: (id: string) => void;
  onAddInitiative: (targetId: string) => void;
}

/**
 * One sustainability target: headline, trajectory pill (same forecast the
 * Pulse widget uses) and the initiatives working towards it.
 */
export function TargetCard({ target, history, initiatives, onDelete, onAddInitiative }: TargetCardProps) {
  const def = METRIC_DEFINITIONS[target.metric_key];

  const status = useMemo(() => {
    if (history.length < 2) return 'unknown';
    return forecastTrajectory({
      history,
      targetDate: target.target_date,
      targetValue: target.target_value,
      higherIsBetter: def?.higherIsBetter ?? false,
    }).targetStatus.status;
  }, [history, target.target_date, target.target_value, def?.higherIsBetter]);

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {def?.label ?? target.metric_key} → {target.target_value.toLocaleString('en-GB')}{' '}
                {def?.unit ?? ''} by {target.target_date}
              </p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', PILL_STYLES[status])}>
                {PILL_LABELS[status]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Baseline {target.baseline_value.toLocaleString('en-GB')} {def?.unit ?? ''} on{' '}
              {target.baseline_date}
              {target.methodology ? ` · ${target.methodology}` : ''}
              {target.notes ? ` · ${target.notes}` : ''}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(target.id)}
            className="text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {initiatives.length === 0 ? (
            <p className="text-xs text-muted-foreground">No actions linked to this target yet.</p>
          ) : (
            initiatives.map((i) => {
              const meta = INITIATIVE_STATUSES[i.status];
              return (
                <Badge key={i.id} variant="outline" className="gap-1 text-[10px] font-normal">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      meta?.colour === 'lime' && 'bg-[#ccff00]',
                      meta?.colour === 'green' && 'bg-green-500',
                      meta?.colour === 'amber' && 'bg-amber-500',
                      meta?.colour === 'red' && 'bg-red-500',
                      meta?.colour === 'slate' && 'bg-slate-400',
                    )}
                  />
                  {i.title}
                </Badge>
              );
            })
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-[#9bbf00] hover:text-[#ccff00]"
            onClick={() => onAddInitiative(target.id)}
          >
            + Add action
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
