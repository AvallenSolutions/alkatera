'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** How many active brands currently have no website on file. */
  missingCount: number;
}

interface FindResult {
  attempted: number;
  found: number;
  queued: number;
  missingApiKey?: boolean;
  errors?: string[];
  samples?: string[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

// A whole-page Gemini failure — no point looping through the rest of the
// portfolio if grounded search itself is down or unconfigured.
function isHardFailure(r: FindResult): boolean {
  if (r.missingApiKey) return true;
  return (r.errors ?? []).some((e) => e.startsWith('grounded_search_error') || e === 'missing_api_key');
}

/**
 * Portfolio-wide "Find websites & data" action. Brands with no website can't be
 * scraped (the brand-website source has nothing to fetch), and website discovery
 * otherwise only runs once at import time — so brands imported before it worked
 * stay empty forever. This button backfills them on demand.
 */
export function FindWebsitesButton({ missingCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);
  const [progress, setProgress] = useState<{ scanned: number; found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (missingCount === 0 && !result) return null;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);

    let cursor: string | null = null;
    let totalFound = 0;
    let totalQueued = 0;
    let totalScanned = 0;
    let last: FindResult | null = null;

    try {
      // Loop one page at a time, advancing the cursor, so no single request
      // runs long enough to hit the function timeout.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res: Response = await fetch('/api/distributor/brands/find-websites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cursor ? { after_id: cursor } : {}),
        });
        const body = (await res.json().catch(() => ({}))) as FindResult & { error?: string };
        if (!res.ok) {
          setError(`Could not run (${body.error ?? res.status}).`);
          return;
        }
        last = body;
        totalFound += body.found ?? 0;
        totalQueued += body.queued ?? 0;
        totalScanned += body.attempted ?? 0;
        setProgress({ scanned: totalScanned, found: totalFound });

        if (isHardFailure(body)) break;
        if (!body.hasMore || !body.nextCursor) break;
        cursor = body.nextCursor;
      }

      setResult({
        attempted: totalScanned,
        found: totalFound,
        queued: totalQueued,
        missingApiKey: last?.missingApiKey,
        errors: last?.errors,
        samples: last?.samples,
      });
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
              ? `Finding… ${progress.found} found / ${progress.scanned} scanned`
              : 'Finding websites…'}
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
              Found {result.found} website{result.found === 1 ? '' : 's'}, queued {result.queued} for
              data finding. Watch the Finding column.
            </span>
          ) : (
            <span className="text-amber-300">
              Found no new websites across {result.attempted} brand
              {result.attempted === 1 ? '' : 's'}.
              {result.missingApiKey
                ? ' Website finding is not configured (GEMINI_API_KEY missing).'
                : result.errors && result.errors.length > 0
                  ? ` Reason: ${result.errors.join('; ')}`
                  : ''}
            </span>
          )}
        </div>
      )}
      {error && <div className="text-[11px] text-destructive text-right max-w-xs">{error}</div>}
    </div>
  );
}
