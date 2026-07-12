'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HealthScoreResponse {
  hasCertification: boolean;
  score?: number;
  trend?: 'up' | 'down' | 'stable';
  previousScore?: number | null;
}

const TREND_WORD: Record<NonNullable<HealthScoreResponse['trend']>, string> = {
  up: 'RISING',
  down: 'FALLING',
  stable: 'STEADY',
};

/**
 * One quiet fact row for the brief: the B Corp certification health score
 * standing right in a working tone, the trend as a mono word beside it.
 * Renders nothing when the org has no certification.
 */
export function CertificationHealthWidget() {
  const [data, setData] = useState<HealthScoreResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/certifications/health-score')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !data.hasCertification || data.score == null) return null;

  const tone =
    data.score >= 80
      ? 'text-studio-good'
      : data.score >= 70
        ? 'text-studio-attention'
        : 'text-studio-stale';

  return (
    <Link
      href="/certifications"
      className="block transition-colors duration-150 ease-studio hover:bg-studio-ink/[0.03]"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
        <div className="min-w-0 truncate text-sm">
          <span className="font-display font-semibold text-foreground">
            B Corp certification health
          </span>
          <span className="text-studio-dim"> · Evidence, data recency and platform quality</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-3">
          {data.trend ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
              {TREND_WORD[data.trend]}
            </span>
          ) : null}
          <span className="flex items-baseline gap-1.5">
            <span className={`font-display text-lg font-bold leading-none tabular-nums ${tone}`}>
              {data.score}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
              / 100
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
