'use client';

/**
 * Pulse -- one-line daily insight.
 *
 * The latest AI-written headline as one quiet line under the statement,
 * click for the full write-up (the existing insight drill). No card, no
 * icon: a mono INSIGHT label, the sentence, a hairline beneath.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useMetricDrill } from '@/lib/pulse/MetricDrillContext';

export function InsightLine() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useMetricDrill();
  const [headline, setHeadline] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dashboard_insights')
        .select('headline')
        .eq('organization_id', currentOrganization.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setHeadline((data?.headline as string) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  if (!headline) return null;

  return (
    <button
      type="button"
      onClick={() => openDrill({ kind: 'widget', id: 'insight-card' })}
      className="group flex w-full items-baseline gap-3 border-b border-studio-hairline pb-3 text-left"
    >
      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
        Insight
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{headline}</span>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim transition-colors duration-150 ease-studio group-hover:text-foreground">
        Read more
      </span>
    </button>
  );
}
