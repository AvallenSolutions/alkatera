'use client';

/**
 * Pulse -- AI insight of the day, compact card.
 *
 * Headline: today's insight title (truncated).
 * Supporting: one-line subhead + Rosa avatar + timestamp.
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface InsightRow {
  id: string;
  generated_at: string;
  headline: string | null;
  narrative_md: string | null;
}

export function InsightCardCompact() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
  const [insight, setInsight] = useState<InsightRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dashboard_insights')
        .select('id, generated_at, headline, narrative_md')
        .eq('organization_id', currentOrganization.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setInsight((data ?? null) as InsightRow | null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const headline = insight?.headline?.trim() || "Today's brief";
  const firstLine = (insight?.narrative_md ?? '').split('\n').find(l => l.trim().length > 0) ?? '';

  return (
    <PulseCard
      icon={Sparkles}
      label="AI insight of the day"
      headline={truncate(headline, 40)}
      sub={insight ? `Generated ${formatDate(insight.generated_at)}` : 'No insight yet'}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'insight-card' })}
    >
      {insight ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {truncate(stripMarkdown(firstLine), 200)}
        </p>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Cron runs at 06:00 local
        </div>
      )}
    </PulseCard>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function stripMarkdown(s: string): string {
  return s.replace(/[*_`#>\[\]]/g, '');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffH = (now - d.getTime()) / 3_600_000;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
