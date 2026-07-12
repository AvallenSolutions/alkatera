'use client';

import { Panel } from '@/components/studio/panel';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { VitalityRing } from '@/components/vitality/VitalityRing';

export interface ScorePillar {
  label: string;
  score: number | null;
}

interface ScoreHeroProps {
  /** Mono heading over the pillar figures, e.g. "GOVERNANCE SCORE". */
  heading: string;
  overallScore: number | null;
  pillars: ScorePillar[];
  dataCompleteness?: number | null;
  /** One quiet line under the figures. */
  blurb?: string;
}

function pillarTone(score: number | null): 'ink' | 'good' | 'attention' | 'stale' {
  if (score === null) return 'ink';
  if (score >= 70) return 'good';
  if (score >= 40) return 'attention';
  return 'stale';
}

/**
 * The family's score, said once: the shared working-tone ring on a
 * hairline track (the vitality treatment), the pillar figures as quiet
 * BigNumbers, and a thin ink completeness bar. No gradients, no
 * coloured pillar cards.
 */
export function ScoreHero({ heading, overallScore, pillars, dataCompleteness, blurb }: ScoreHeroProps) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-8 py-2 lg:flex-row lg:items-center">
        <VitalityRing score={overallScore} size="lg" />
        <div className="min-w-0 flex-1">
          <Eyebrow tone="dim">{heading}</Eyebrow>
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-5">
            {pillars.map((pillar) => (
              <BigNumber
                key={pillar.label}
                value={pillar.score !== null ? Math.round(pillar.score) : '·'}
                label={pillar.label}
                tone={pillarTone(pillar.score)}
              />
            ))}
          </div>
          {typeof dataCompleteness === 'number' ? (
            <div className="mt-5 flex max-w-xs items-center gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-studio-hairline">
                <div
                  className="h-full rounded-full bg-studio-ink"
                  style={{ width: `${Math.min(Math.max(dataCompleteness, 0), 100)}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim tabular-nums">
                {Math.round(dataCompleteness)}% complete
              </span>
            </div>
          ) : null}
          {blurb ? <p className="mt-3 text-xs text-muted-foreground">{blurb}</p> : null}
        </div>
      </div>
    </Panel>
  );
}
