'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** How many active brands currently have no website on file. */
  missingCount: number;
}

interface BackfillRun {
  id: string;
  status: 'running' | 'done' | 'error';
  total: number;
  found: number;
  queued: number;
  gemini_configured: boolean | null;
  errors: string[];
  samples: string[];
  message: string | null;
}

const POLL_MS = 4000;
const MAX_POLLS = 120; // ~8 minutes

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Portfolio-wide "Find websites & data" action. Brands with no website can't be
 * scraped (the brand-website source has nothing to fetch), and website discovery
 * otherwise only runs once at import time — so brands imported before it worked
 * stay empty forever. This kicks off a background backfill and polls the run row
 * for its outcome, surfacing the real reason when a run finds nothing.
 */
export function FindWebsitesButton({ missingCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<BackfillRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (missingCount === 0 && !run) return null;

  async function pollRun(runId: string): Promise<BackfillRun | null> {
    try {
      const res = await fetch(
        `/api/distributor/brands/find-websites?run_id=${encodeURIComponent(runId)}`,
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { run?: BackfillRun | null };
      return body.run ?? null;
    } catch {
      return null;
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    setRun(null);

    try {
      const res = await fetch('/api/distributor/brands/find-websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        total?: number;
        runId?: string | null;
        error?: string;
      };
      if (!res.ok && res.status !== 202) {
        setError(`Could not start (${body.error ?? res.status}).`);
        return;
      }
      if (body.status === 'noop' || !body.total) {
        setRun({
          id: 'noop',
          status: 'done',
          total: 0,
          found: 0,
          queued: 0,
          gemini_configured: null,
          errors: [],
          samples: [],
          message: 'nothing-to-do',
        });
        return;
      }
      if (!body.runId) {
        setError('Run started but no run id was returned — check the Netlify logs.');
        return;
      }

      // Poll the run row until the background function records its outcome.
      let latest: BackfillRun | null = null;
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_MS);
        const r = await pollRun(body.runId);
        if (r) {
          latest = r;
          setRun(r);
          if (r.status === 'done' || r.status === 'error') break;
        }
      }
      if (latest && (latest.found > 0 || latest.queued > 0)) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setBusy(false);
    }
  }

  const terminal = run && (run.status === 'done' || run.status === 'error');

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <Button
        onClick={start}
        disabled={busy}
        variant="outline"
        className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            {run && run.status === 'running'
              ? `Finding… (${run.total} brand${run.total === 1 ? '' : 's'})`
              : 'Starting…'}
          </>
        ) : (
          <>
            <Globe className="h-4 w-4 mr-1.5" /> Find websites &amp; data
            {missingCount > 0 && (
              <span className="ml-1.5 text-[11px] text-sky-300/80">({missingCount} missing)</span>
            )}
          </>
        )}
      </Button>

      {terminal && run && (
        <div className="text-[11px] text-right max-w-sm">
          {run.found > 0 ? (
            <span className="text-emerald-300">
              <Sparkles className="inline h-3 w-3 mr-0.5" />
              Found {run.found} website{run.found === 1 ? '' : 's'} and queued {run.queued} for data
              finding. Watch the Finding column.
            </span>
          ) : run.gemini_configured === false ? (
            <span className="text-destructive">
              Website finding is not configured: GEMINI_API_KEY isn&apos;t visible to the Netlify
              functions runtime. Add it to the Functions scope and redeploy.
            </span>
          ) : run.errors && run.errors.length > 0 ? (
            <span className="text-destructive">
              Grounded search failed: {run.errors.join('; ')}.
              {run.samples && run.samples.length > 0 && (
                <span className="block text-muted-foreground mt-0.5">
                  Model said: {run.samples[0].slice(0, 160)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-amber-300">
              No discoverable official site found across {run.total} brand
              {run.total === 1 ? '' : 's'}. Try pasting a URL on the brand page.
            </span>
          )}
        </div>
      )}
      {error && <div className="text-[11px] text-destructive text-right max-w-xs">{error}</div>}
    </div>
  );
}
