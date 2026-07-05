'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HealthScoreResponse {
  hasCertification: boolean;
  score?: number;
  trend?: 'up' | 'down' | 'stable';
  previousScore?: number | null;
}

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

  const trendIcon =
    data.trend === 'up' ? (
      <TrendingUp className="h-4 w-4 text-studio-good" />
    ) : data.trend === 'down' ? (
      <TrendingDown className="h-4 w-4 text-studio-stale" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  const tone =
    data.score >= 80
      ? 'text-studio-good'
      : data.score >= 70
        ? 'text-studio-attention'
        : 'text-studio-stale';

  return (
    <Link href="/certifications" className="block">
      <div className="rounded-[6px] border border-border bg-card transition-colors duration-200 ease-studio hover:border-foreground/30">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-studio-dim" />
            <div>
              <p className="text-sm font-medium">B Corp certification health</p>
              <p className="text-xs text-muted-foreground">
                Evidence, data recency and platform quality
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trendIcon}
            <span className="flex items-baseline gap-1.5">
              <span className={`font-display text-2xl font-bold leading-none tabular-nums ${tone}`}>
                {data.score}
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
                / 100
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
