'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    ) : data.trend === 'down' ? (
      <TrendingDown className="h-4 w-4 text-red-600" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  const tone =
    data.score >= 80
      ? 'text-emerald-600'
      : data.score >= 70
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <Link href="/certifications" className="block">
      <Card className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-sm font-medium">B Corp certification health</p>
              <p className="text-xs text-muted-foreground">
                Evidence, data recency and platform quality
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trendIcon}
            <span className={`text-2xl font-bold ${tone}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
