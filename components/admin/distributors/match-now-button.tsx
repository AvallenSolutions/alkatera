'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Summary {
  scanned: number;
  linked: number;
  suggested: number;
  tier_updates: number;
  alkatera_synced: number;
  errors: string[];
}

/**
 * Admin-side one-click trigger for the alka**tera** brand-matching
 * sweep. Used right after a distributor SKU upload to link any of
 * the 22 platform organisations to the freshly-imported brand
 * profiles without waiting for the 03:00 UTC cron.
 */
export function MatchNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/run-brand-matching', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as Summary;
      setResult(body);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[6px] border border-border bg-card px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Match brands to alka<strong>tera</strong> now
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Walks every unlinked brand_profile across distributors, auto-links high-confidence
          matches against the 22 alka<strong>tera</strong> organisations, re-syncs live data
          for existing links. Equivalent to one run of the 03:00 UTC cron.
        </div>
        {result && (
          <div className="text-[11px] text-studio-good mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            scanned {result.scanned} · linked {result.linked} · suggested{' '}
            {result.suggested} · tier {result.tier_updates} · synced{' '}
            {result.alkatera_synced}
            {result.errors.length > 0 && (
              <span className="text-studio-attention ml-2">
                {result.errors.length} errors
              </span>
            )}
          </div>
        )}
        {error && (
          <div className="text-[11px] text-studio-stale mt-2 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>
      <Button
        onClick={run}
        disabled={busy}
        variant="outline"
        size="sm"
        className="shrink-0"
      >
        {busy ? (
          'Matching...'
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Run now
          </>
        )}
      </Button>
    </div>
  );
}
