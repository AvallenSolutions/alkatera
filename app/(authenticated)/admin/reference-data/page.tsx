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
import { Database, Play, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-semibold">Reference data</h1>
          <p className="text-sm text-muted-foreground">
            Load official public emission-factor datasets into the versioned factor library.
            Once a set is loaded, corporate emissions use its factors in preference to the
            built-in defaults, with full provenance and version history.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {!loaders ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : loaders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No loaders registered.</p>
      ) : (
        <div className="space-y-4">
          {loaders.map((l) => (
            <Card key={l.key}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{l.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{l.description}</p>
                </div>
                {l.isCurrent ? (
                  <Badge variant="secondary" className="gap-1 whitespace-nowrap">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Current
                  </Badge>
                ) : l.loaded ? (
                  <Badge variant="outline" className="whitespace-nowrap">Superseded</Badge>
                ) : (
                  <Badge variant="outline" className="whitespace-nowrap">Not loaded</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>Version <span className="font-medium text-foreground">{l.version}</span></span>
                  <span>Licence <span className="font-medium text-foreground">{l.licence}</span></span>
                  <span>Factors <span className="font-medium text-foreground">{l.factorCount}</span></span>
                  {l.sourceUrl && (
                    <a
                      href={l.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Source <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <Button onClick={() => run(l.key)} disabled={running === l.key}>
                  <Play className="mr-2 h-4 w-4" />
                  {running === l.key ? 'Starting…' : l.loaded ? 'Reload latest' : 'Load latest'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Loads run in the background and are safe to repeat — a release refreshes in place, and
        loading a newer version supersedes the prior one while retaining it for historical
        recompute.
      </p>
    </div>
  );
}
