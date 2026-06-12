'use client';

/**
 * Pulse Overview -- one-line daily insight.
 *
 * The latest AI-written headline, one line, click for the full write-up
 * (the existing insight drill). Replaces the full insight card on first
 * paint.
 */

import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
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
      className="group flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-card/60 px-4 py-2.5 text-left transition-colors hover:border-[#ccff00]/50"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-[#ccff00]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{headline}</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
        Read more
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}
