'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** How many active brands currently have no website on file. */
  missingCount: number;
}

const POLL_MS = 4000;
const MAX_POLLS = 90; // ~6 minutes — comfortably covers the 15-min bg window's useful span
const PLATEAU_POLLS = 4; // stop once the count hasn't moved for this many polls

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithout(): Promise<number | null> {
  try {
    const res = await fetch('/api/distributor/brands/find-websites', { method: 'GET' });
    if (!res.ok) return null;
    const body = (await res.json()) as { without_website?: number };
    return typeof body.without_website === 'number' ? body.without_website : null;
  } catch {
    return null;
  }
}

/**
 * Portfolio-wide "Find websites & data" action. Brands with no website can't be
 * scraped (the brand-website source has nothing to fetch), and website discovery
 * otherwise only runs once at import time — so brands imported before it worked
 * stay empty forever. This button kicks off a background backfill and then polls
 * the website-less count, reporting progress as websites land.
 */
export function FindWebsitesButton({ missingCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ found: number; baseline: number } | null>(null);
  const [progress, setProgress] = useState<{ found: number; baseline: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (missingCount === 0 && !result) return null;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      // Kick off the background backfill.
      const res = await fetch('/api/distributor/brands/find-websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        total?: number;
        error?: string;
      };
      if (!res.ok && res.status !== 202) {
        setError(`Could not start (${body.error ?? res.status}).`);
        return;
      }
      if (body.status === 'noop' || !body.total) {
        setResult({ found: 0, baseline: 0 });
        return;
      }

      // Poll the website-less count and watch it fall. The background run saves
      // websites as it finds them, so `baseline - without` is websites found.
      const baseline = body.total;
      let prev = baseline;
      let stable = 0;

      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_MS);
        const without = await fetchWithout();
        if (without === null) continue;

        const found = Math.max(0, baseline - without);
        setProgress({ found, baseline });

        if (without === 0) {
          prev = without;
          break;
        }
        if (without === prev) {
          stable += 1;
          if (stable >= PLATEAU_POLLS) break; // finder finished; the rest had no findable site
        } else {
          stable = 0;
          prev = without;
        }
      }

      setResult({ found: Math.max(0, baseline - prev), baseline });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <Button
        onClick={run}
        disabled={busy}
        variant="outline"
        className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            {progress
              ? `Finding… ${progress.found} of ${progress.baseline} found`
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
      {result && (
        <div className="text-[11px] text-right max-w-xs">
          {result.found > 0 ? (
            <span className="text-emerald-300">
              <Sparkles className="inline h-3 w-3 mr-0.5" />
              Found {result.found} website{result.found === 1 ? '' : 's'} and queued them for data
              finding. Watch the Finding column.
            </span>
          ) : (
            <span className="text-amber-300">
              No new websites found across {result.baseline} brand
              {result.baseline === 1 ? '' : 's'}. They may not have a discoverable official site —
              try pasting a URL on the brand page. (Check the Netlify <code>[find-websites-bg]</code>{' '}
              logs if you expected results.)
            </span>
          )}
        </div>
      )}
      {error && <div className="text-[11px] text-destructive text-right max-w-xs">{error}</div>}
    </div>
  );
}
