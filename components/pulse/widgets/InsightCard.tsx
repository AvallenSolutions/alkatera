'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InsightShareDialog } from '@/components/pulse/InsightShareDialog';

interface DashboardInsight {
  id: string;
  generated_at: string;
  headline: string;
  narrative_md: string;
  model: string;
  confidence: number | null;
}

/**
 * Pulse — InsightCard
 *
 * Reads the most recent row from dashboard_insights for the active org.
 * "Refresh" calls /api/pulse/refresh-insight to regenerate (rate-limited
 * to one call per hour per org).
 */
export function InsightCard() {
  const { currentOrganization } = useOrganization();
  const [insight, setInsight] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dashboard_insights')
        .select('id, generated_at, headline, narrative_md, model, confidence')
        .eq('organization_id', currentOrganization.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setInsight((data as DashboardInsight) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  async function refresh() {
    if (!currentOrganization?.id) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/pulse/refresh-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: currentOrganization.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? body.error ?? `Failed (${res.status})`);
        return;
      }
      // Re-fetch the freshly inserted row.
      const { data } = await supabase
        .from('dashboard_insights')
        .select('id, generated_at, headline, narrative_md, model, confidence')
        .eq('id', body.id)
        .single();
      setInsight(data as DashboardInsight);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80">
      <CardContent className="flex flex-col space-y-4 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Insight of the day
            </h3>
            {insight?.model && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {insight.model.replace('claude-', '').replace('-4-6', ' 4.6')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShareOpen(true)}
              disabled={!insight}
              className="text-xs"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={refresh}
              disabled={refreshing}
              className="text-xs"
            >
              {refreshing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading insight…</p>
        ) : insight ? (
          <>
            <h2 className="text-xl font-semibold leading-snug text-foreground sm:text-2xl">
              {insight.headline}
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-muted-foreground">
              {insight.narrative_md}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Generated {new Date(insight.generated_at).toLocaleString('en-GB')}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No insight yet. Tap Refresh to generate the first one, or wait for the morning brief.
          </p>
        )}

        {error && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {error}
          </p>
        )}
      </CardContent>
      {insight && (
        <InsightShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          insightId={insight.id}
          insightHeadline={insight.headline}
        />
      )}
    </Card>
  );
}
