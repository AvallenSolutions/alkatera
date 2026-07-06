'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RescoreBatch {
  ok: boolean;
  total: number;
  offset: number;
  processed: number;
  updated: number;
  next_offset: number;
  done: boolean;
  error_count: number;
  error?: string;
}

interface RescoreSummary {
  updated: number;
  total: number;
  error_count: number;
}

/**
 * Re-runs the unified brand scorer across the directory via
 * POST /api/admin/directory/rescore (alka**tera**-admin cookie auth).
 * Use after a scoring-model change to refresh persisted scores, tiers,
 * category and country without waiting for organic recompute triggers.
 *
 * The endpoint processes a SMALL batch per request (keeping each call
 * under Netlify's function ceiling); this button loops through batches
 * automatically, showing live progress, until the whole directory is
 * done.
 */
export function RescoreAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<RescoreSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);

    let offset = 0;
    let updated = 0;
    let errorCount = 0;
    let total = 0;
    // Hard stop so a bug can never spin forever (8/batch * 400 = 3.2k rows).
    for (let guard = 0; guard < 400; guard += 1) {
      // Retry a batch a couple of times before giving up, so one transient
      // 502/timeout doesn't abort the whole walk and leave brands unscored.
      let json: RescoreBatch | null = null;
      let lastErr = '';
      for (let attempt = 0; attempt < 3 && !json; attempt += 1) {
        try {
          const res = await fetch('/api/admin/directory/rescore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offset, limit: 8 }),
          });
          if (!res.ok) {
            lastErr = `HTTP ${res.status}`;
            continue;
          }
          json = (await res.json()) as RescoreBatch;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      if (!json) {
        setError(`${lastErr} (stopped at brand ${offset} of ${total || '?'})`);
        setBusy(false);
        return;
      }
      if (!json.ok) {
        setError(json.error ?? 'Rescore failed');
        setBusy(false);
        return;
      }
      updated += json.updated;
      errorCount += json.error_count;
      total = json.total;
      offset = json.next_offset;
      setProgress({ done: Math.min(offset, total), total });
      if (json.done) break;
    }

    setResult({ updated, total, error_count: errorCount });
    setProgress(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {busy && progress && (
        <span className="text-[11px] text-muted-foreground">
          Rescoring {progress.done}/{progress.total}…
        </span>
      )}
      {result && (
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-studio-good" />
          Rescored {result.updated}/{result.total}
          {result.error_count > 0 ? ` · ${result.error_count} errors` : ''}
        </span>
      )}
      {error && (
        <span className="text-[11px] text-studio-stale inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        {!busy && <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
        {busy ? 'Rescoring…' : 'Rescore all'}
      </Button>
    </div>
  );
}
