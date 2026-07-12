'use client';

/**
 * For recertifying B Corps: surfaces ONLY what's new or changed under the 2026
 * standard versus what they already do, so they don't re-prove everything.
 * Carried-over requirements are summarised as a reassuring count.
 */

import { ArrowRight, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PillButton, StateChip } from '@/components/studio';
import type { WorkingTone } from '@/components/studio/theme';
import { cn } from '@/lib/utils';
import type { CertificationReadiness } from '@/lib/certifications/scoring';
import { DELTA_LABEL, getRecertDelta, type DeltaKind } from '@/lib/certifications/recert-deltas';

const KIND_TONE: Record<DeltaKind, WorkingTone> = {
  new: 'hold',
  changed: 'attention',
  carried_over: 'quiet',
};

export function RecertDeltaCard({
  readiness,
  onOpen,
}: {
  readiness: CertificationReadiness;
  onOpen: (requirementId: string) => void;
}) {
  const tagged = readiness.requirementStatuses
    .filter((rs) => rs.applicable !== false)
    .map((rs) => ({
      rs,
      delta: getRecertDelta(rs.code, rs.topicArea, rs.applicableFromYear),
    }));
  const counts = { new: 0, changed: 0, carried_over: 0 } as Record<DeltaKind, number>;
  for (const t of tagged) counts[t.delta.kind] += 1;

  // The deltas to actually work on: new/changed that aren't already passed.
  const deltas = tagged
    .filter((t) => t.delta.kind !== 'carried_over' && t.rs.status !== 'passed')
    .sort((a, b) => (a.delta.kind === b.delta.kind ? a.rs.code.localeCompare(b.rs.code) : a.delta.kind === 'new' ? -1 : 1));

  return (
    <Card className="border-studio-hold/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-studio-hold" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recertifying onto the 2026 standard</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You don&apos;t need to re-prove everything. Focus on what&apos;s new or changed; the rest carries over from your existing certification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat n={counts.new} label="New" tone="text-studio-hold" />
          <Stat n={counts.changed} label="Changed" tone="text-studio-attention" />
          <Stat n={counts.carried_over} label="Carried over" tone="text-muted-foreground" />
        </div>

        {deltas.length === 0 ? (
          <p className="rounded-[6px] border border-studio-good/30 bg-studio-cream p-3 text-sm text-studio-good">
            Every new and changed 2026 requirement for your current year is already met.
          </p>
        ) : (
          <ul className="space-y-2">
            {deltas.slice(0, 8).map(({ rs, delta }) => (
              <li key={rs.requirementId} className="flex items-start justify-between gap-3 rounded-[6px] border border-border/60 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateChip tone={KIND_TONE[delta.kind]}>
                      {DELTA_LABEL[delta.kind]}
                    </StateChip>
                    <span className="font-mono text-xs text-muted-foreground">{rs.code}</span>
                    <span className="text-sm font-medium text-foreground">{rs.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{delta.note}</p>
                </div>
                <PillButton variant="outline" size="sm" className="shrink-0" onClick={() => onOpen(rs.requirementId)}>
                  Open <ArrowRight className="ml-1 h-3 w-3" />
                </PillButton>
              </li>
            ))}
          </ul>
        )}
        {deltas.length > 8 && (
          <p className="text-[11px] text-muted-foreground">{deltas.length - 8} more new/changed requirements below.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-[6px] border border-border/60 bg-card/40 p-2">
      <p className={cn('font-display text-2xl font-semibold tabular-nums', tone)}>{n}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
