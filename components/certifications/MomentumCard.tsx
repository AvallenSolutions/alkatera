'use client';

/**
 * B Corp momentum: shows the readiness trajectory from score history so a brand
 * can see progress (and take it to leadership). Renders nothing until there are
 * at least two snapshots to compare.
 */

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/pulse/Sparkline';
import { useOrganization } from '@/lib/organizationContext';

interface ScoreRow {
  score_date: string;
  overall_score: number | null;
  requirements_met: number | null;
}

export function MomentumCard() {
  const { currentOrganization } = useOrganization();
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/certifications/score?organization_id=${currentOrganization.id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRows((json.scoreHistory ?? []) as ScoreRow[]);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  if (!rows) return null;
  const asc = rows
    .filter((r) => r.overall_score != null)
    .slice()
    .sort((a, b) => a.score_date.localeCompare(b.score_date));
  if (asc.length < 2) return null;

  const values = asc.map((r) => Number(r.overall_score));
  const delta = Math.round(values[values.length - 1] - values[0]);
  const metLatest = asc[asc.length - 1].requirements_met;
  const up = delta >= 0;

  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <TrendingUp className={up ? 'h-5 w-5 text-studio-good' : 'h-5 w-5 text-studio-stale'} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Your momentum</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Readiness is {up ? 'up' : 'down'} {Math.abs(delta)} point{Math.abs(delta) === 1 ? '' : 's'} since you started tracking
            {metLatest != null ? `, with ${metLatest} requirements now met` : ''}.
          </p>
        </div>
        <div className="w-32 shrink-0">
          <Sparkline values={values} stroke={up ? '#047857' : '#BE123C'} height={28} />
        </div>
      </CardContent>
    </Card>
  );
}
