'use client';

/**
 * Admin: Agribalyse food-factor backfill.
 *
 * Calculates cradle-to-gate carbon/water/land factors for common restaurant
 * food commodities from the Agribalyse v3.2 database and stores them in
 * staging_emission_factors, so hospitality meal/drink ingredients resolve to
 * real numbers. The run happens in the background (Inngest); this page kicks it
 * off and polls coverage.
 */

import { useCallback, useEffect, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/studio/panel';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { useToast } from '@/hooks/use-toast';

interface Coverage {
  configured: boolean;
  targetCount: number;
  agribalyseFactorCount: number;
  ingredientFactorCount: number;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data?.session?.access_token ?? ''}` };
}

export default function AgribalyseBackfillPage() {
  const { toast } = useToast();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agribalyse-backfill', { headers: await authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load coverage');
      }
      setCoverage(await res.json());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load coverage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While polling, refresh coverage every 8s so the admin sees the count climb.
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [polling, refresh]);

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/agribalyse-backfill', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to start backfill');
      }
      toast({
        title: 'Backfill started',
        description: 'Calculating factors in the background. Coverage will update as it runs.',
      });
      setPolling(true);
    } catch (e: unknown) {
      toast({
        title: 'Could not start backfill',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const pct = coverage && coverage.targetCount > 0
    ? Math.min(100, Math.round((coverage.agribalyseFactorCount / coverage.targetCount) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Eyebrow tone="dim" className="mb-3">THE WIRING · ADMIN</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-foreground">
          Agribalyse food factors.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Backfill cradle-to-gate carbon, water and land factors for common restaurant
          ingredients from Agribalyse v3.2, so hospitality meals resolve to real numbers.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Panel>
        <div className="mb-4 flex flex-row items-center justify-between space-y-0">
          <h2 className="font-display text-base font-semibold text-foreground">Coverage</h2>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="space-y-4">
          {!coverage ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {coverage.configured ? (
                  <StateChip tone="good">Agribalyse server configured</StateChip>
                ) : (
                  <StateChip tone="stale">Server not configured</StateChip>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Target factors present</span>
                  <span className="font-medium">
                    {coverage.agribalyseFactorCount} / {coverage.targetCount}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {coverage.ingredientFactorCount} total ingredient factors in the staging library.
              </p>
            </>
          )}
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={running || !coverage?.configured}>
          <Play className="mr-2 h-4 w-4" />
          {running ? 'Starting…' : 'Run backfill'}
        </Button>
        {polling && (
          <span className="text-sm text-muted-foreground">
            Running in the background…
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Each commodity needs a short Agribalyse calculation, so the full run takes several
        minutes. It&apos;s safe to run repeatedly: factors are refreshed in place, not duplicated.
      </p>
    </div>
  );
}
