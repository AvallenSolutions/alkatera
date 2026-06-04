'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RescoreResult {
  ok: boolean;
  scanned: number;
  updated: number;
  error_count: number;
  cap: number;
}

/**
 * Re-runs the unified brand scorer across the directory via
 * POST /api/admin/directory/rescore (alka**tera**-admin cookie auth).
 * Use after a scoring-model change to refresh persisted scores +
 * tiers without waiting for organic recompute triggers.
 *
 * The endpoint processes a batch (most-recently-updated first); for a
 * directory larger than the batch cap, click again until `updated`
 * reaches zero / the count stops moving.
 */
export function RescoreAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RescoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/directory/rescore', { method: 'POST' });
      const json = (await res.json()) as RescoreResult & { error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Failed (${res.status})`);
      } else {
        setResult(json);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Rescored {result.updated}/{result.scanned}
          {result.scanned >= result.cap ? ' (batch — click again for more)' : ''}
          {result.error_count > 0 ? ` · ${result.error_count} errors` : ''}
        </span>
      )}
      {error && (
        <span className="text-[11px] text-destructive inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        )}
        {busy ? 'Rescoring…' : 'Rescore all'}
      </Button>
    </div>
  );
}
