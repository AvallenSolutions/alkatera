'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Activity, ExternalLink } from 'lucide-react';
import { StateChip } from '@/components/studio';
import type { WorkingTone } from '@/components/studio/theme';
import type { PlatformHealthEntry } from '@/lib/certifications/scoring';

interface PlatformHealthPanelProps {
  entries: PlatformHealthEntry[];
}

const STATUS_BADGE: Record<
  PlatformHealthEntry['status'],
  { label: string; tone: WorkingTone }
> = {
  complete: { label: 'Complete', tone: 'good' },
  partial: { label: 'Partial', tone: 'attention' },
  missing: { label: 'No data', tone: 'stale' },
};

export function PlatformHealthPanel({ entries }: PlatformHealthPanelProps) {
  if (!entries || entries.length === 0) return null;

  const needsAttention = entries.filter((e) => e.status !== 'complete');
  if (needsAttention.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-room-accent" />
          Platform Health
        </CardTitle>
        <CardDescription>
          alkatera modules that need attention to support your B Corp
          requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {needsAttention.map((e) => {
          const badge = STATUS_BADGE[e.status];
          return (
            <div
              key={e.module}
              className="flex items-start justify-between gap-3 rounded-[6px] border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold">{e.moduleLabel}</span>
                  <StateChip tone={badge.tone}>{badge.label}</StateChip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.note ??
                    `Affects ${e.requirementCodes.length} requirement(s): ${e.requirementCodes.join(', ')}`}
                </p>
                {e.actionLinks && e.actionLinks.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {e.actionLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        className="text-xs text-room-accent hover:underline"
                      >
                        {link.label} →
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={e.moduleLink}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-room-accent hover:underline"
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
