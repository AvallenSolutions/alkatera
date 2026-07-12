'use client';

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { METRIC_DEFINITIONS } from '@/lib/pulse/metric-keys';
import { forecastTrajectory } from '@/lib/pulse/forecast';
import { INITIATIVE_STATUSES } from '@/lib/pulse/initiative-status';
import type { WorkingTone } from '@/components/studio/theme';
import type { Initiative, Target } from './types';

// Typographic state chips: working tones from components/studio/theme.ts.
const PILL_STYLES: Record<string, string> = {
  on_track: 'text-studio-good',
  at_risk: 'text-studio-attention',
  off_track: 'text-studio-stale',
  unknown: 'text-studio-dim',
};

// Working tone → status dot fill.
const TONE_DOT: Record<WorkingTone, string> = {
  good: 'bg-studio-good',
  attention: 'bg-studio-attention',
  stale: 'bg-studio-stale',
  hold: 'bg-studio-hold',
  quiet: 'bg-studio-dim',
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
              <span className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.18em]', PILL_STYLES[status])}>
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
            className="text-muted-foreground hover:text-studio-stale"
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
                <span key={i.id} className="inline-flex items-center gap-1.5 text-xs text-foreground">
                  <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[meta.tone])} />
                  {i.title}
                </span>
              );
            })
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-studio-forest hover:text-studio-forest/80"
            onClick={() => onAddInitiative(target.id)}
          >
            + Add action
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
