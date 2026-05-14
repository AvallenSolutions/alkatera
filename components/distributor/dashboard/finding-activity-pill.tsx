'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Search } from 'lucide-react';

interface Summary {
  queued: number;
  running: number;
  complete: number;
  error: number;
  skipped: number;
}

const ACTIVE_POLL_MS = 6_000;
const IDLE_POLL_MS = 60_000;

/**
 * Header-level pill on the distributor dashboard that shows whether
 * data-finding work is currently in flight across the portfolio.
 * Polls /api/distributor/scraping/status — fast while there's any
 * queued/running job, slow otherwise.
 *
 * When the in-flight count transitions back to zero, fires
 * router.refresh() so the dashboard's stat cards and chart pick up
 * any new findings written by the run.
 */
export function FindingActivityPill() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const previousInFlightRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch('/api/distributor/scraping/status', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { summary: Summary };
        if (cancelled) return;
        const s = body.summary;
        setSummary(s);

        const inFlight = (s.queued ?? 0) + (s.running ?? 0);
        const prev = previousInFlightRef.current;
        if (prev != null && prev > 0 && inFlight === 0) {
          router.refresh();
        }
        previousInFlightRef.current = inFlight;
      } catch {
        // best-effort
      }
    }

    function schedule() {
      const inFlight = (summary?.queued ?? 0) + (summary?.running ?? 0);
      const delay = inFlight > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
      timer = setTimeout(async () => {
        await poll();
        if (!cancelled) schedule();
      }, delay);
    }

    (async () => {
      await poll();
      if (!cancelled) schedule();
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary) return null;
  const inFlight = summary.queued + summary.running;

  if (inFlight > 0) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 text-xs">
        <Loader2 className="h-3 w-3 text-sky-300 animate-spin" />
        <span className="text-sky-300 font-medium">
          Finding data for {inFlight} brand{inFlight === 1 ? '' : 's'}
        </span>
        {summary.queued > 0 && (
          <span className="text-muted-foreground">
            · {summary.queued} queued
          </span>
        )}
      </div>
    );
  }

  // Idle but completed at least once → show a quiet "ready" state.
  if (summary.complete > 0) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 text-sky-400" />
        Data finder idle · {summary.complete} run{summary.complete === 1 ? '' : 's'} complete
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Search className="h-3 w-3" /> Data finder ready
    </div>
  );
}
