'use client';

/**
 * Admin: external reference-data loaders (Foundation A).
 *
 * Loads public emission-factor releases (DESNZ GHG conversion factors first)
 * into the versioned factor_sets / reference_factors library. Once a set is
 * loaded, the corporate emissions engine reads its factors in preference to the
 * built-in constants. The load runs in the background (Inngest); this page kicks
 * it off and polls status.
 */

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { useToast } from '@/hooks/use-toast';

interface LoaderStatus {
  key: string;
  label: string;
  description: string;
  provider: string;
  dataset: string;
  version: string;
  licence: string;
  sourceUrl: string | null;
  loaded: boolean;
  isCurrent: boolean;
  loadedAt: string | null;
  factorCount: number;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data?.session?.access_token ?? ''}` };
}

export default function ReferenceDataPage() {
  const { toast } = useToast();
  const [loaders, setLoaders] = useState<LoaderStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reference-data', { headers: await authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load status');
      }
      const data = await res.json();
      setLoaders(data.loaders ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While polling, refresh status every 5s so the admin sees the factor count land.
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [polling, refresh]);

  const run = async (loaderKey: string) => {
    setRunning(loaderKey);
    try {
      const res = await fetch('/api/admin/reference-data', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ loaderKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to start load');
      }
      toast({
        title: 'Load started',
        description: 'Loading the factor set in the background. Status will update shortly.',
      });
      setPolling(true);
    } catch (e: unknown) {
      toast({
        title: 'Could not start load',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Reference data." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          Load official public emission-factor datasets into the versioned factor library.
          Once a set is loaded, corporate emissions use its factors in preference to the
          built-in defaults, with full provenance and version history.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      <div className="flex justify-end">
        <PillButton variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          Refresh
        </PillButton>
      </div>

      {!loaders ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      ) : loaders.length === 0 ? (
        <p className="text-sm text-studio-dim">No loaders registered.</p>
      ) : (
        <div className="space-y-4">
          {loaders.map((l) => (
            <Panel key={l.key}>
              <div className="mb-4 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-display text-base font-semibold text-foreground">{l.label}</h2>
                  <p className="text-sm text-studio-dim">{l.description}</p>
                </div>
                {l.isCurrent ? (
                  <StateChip tone="good">Current</StateChip>
                ) : l.loaded ? (
                  <StateChip tone="stale">Superseded</StateChip>
                ) : (
                  <StateChip tone="quiet">Not loaded</StateChip>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-studio-dim">
                  <span>Version <span className="font-medium text-foreground">{l.version}</span></span>
                  <span>Licence <span className="font-medium text-foreground">{l.licence}</span></span>
                  <span>Factors <span className="font-medium tabular-nums text-foreground">{l.factorCount}</span></span>
                  {l.sourceUrl && (
                    <a
                      href={l.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-foreground underline decoration-studio-hairline underline-offset-4 hover:decoration-studio-ink"
                    >
                      Source <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <PillButton onClick={() => run(l.key)} disabled={running === l.key}>
                  {running === l.key ? 'Starting…' : l.loaded ? 'Reload latest' : 'Load latest'}
                </PillButton>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <p className="text-xs text-studio-dim">
        Loads run in the background and are safe to repeat: a release refreshes in place, and
        loading a newer version supersedes the prior one while retaining it for historical
        recompute.
      </p>
    </div>
  );
}
