'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Combine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DupeGroup {
  canonical_id: string;
  duplicate_ids: string[];
  confidence: number;
  reason: string;
}

interface DedupResponse {
  ok: true;
  summary: string | null;
  merged_groups: Array<DupeGroup & { merged_count: number; errors: string[] }>;
  review_groups: DupeGroup[];
  total_products: number;
}

interface Props {
  brandId: string;
  productCount: number;
}

/**
 * Admin tool to deduplicate products on a single brand. Triggers a
 * Claude Sonnet sweep that groups same-SKU rows, auto-merges high-
 * confidence groups (≥0.85), and surfaces mid-confidence groups
 * (0.6-0.85) for the admin to confirm manually.
 */
export function BrandProductDedupControl({ brandId, productCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DedupResponse | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/dedup-products`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as
        | DedupResponse
        | { error?: string; detail?: string };
      if (!res.ok || !('ok' in body)) {
        setError(
          (body as { detail?: string; error?: string }).detail ??
            (body as { detail?: string; error?: string }).error ??
            `HTTP ${res.status}`,
        );
        return;
      }
      setResult(body);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sweep failed');
    } finally {
      setBusy(false);
    }
  }

  if (productCount < 2) return null;

  const autoMerged = result
    ? result.merged_groups.reduce((acc, g) => acc + g.merged_count, 0)
    : 0;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card/40 to-card/40 p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Combine className="h-4 w-4 text-amber-300" />
          Dedup products
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Sweeps the brand's {productCount} product
          {productCount === 1 ? '' : 's'} and asks Claude to identify same-SKU groups.
          High-confidence matches (≥85%) are auto-merged; weaker matches are listed below
          for you to confirm.
        </p>
      </div>

      <Button
        onClick={run}
        disabled={busy}
        className="bg-amber-300 hover:bg-amber-300/90 text-black font-semibold"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sweeping…
          </>
        ) : (
          <>
            <Combine className="h-4 w-4 mr-1.5" /> Dedup products
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold">
                {autoMerged} duplicate{autoMerged === 1 ? '' : 's'} auto-merged
                {result.review_groups.length > 0 && (
                  <>
                    {' '}
                    · {result.review_groups.length} group
                    {result.review_groups.length === 1 ? '' : 's'} to review
                  </>
                )}
              </div>
              {result.summary && (
                <div className="text-[11px] italic text-muted-foreground">{result.summary}</div>
              )}
            </div>
          </div>

          {result.merged_groups.length > 0 && (
            <ul className="text-[12px] space-y-1.5">
              {result.merged_groups.map((g, i) => (
                <li
                  key={i}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300 text-[10px] uppercase tracking-wider font-semibold">
                      merged
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.round(g.confidence * 100)}% confidence
                    </span>
                    {g.errors.length > 0 && (
                      <span className="text-[10px] text-amber-300">
                        {g.errors.length} failed
                      </span>
                    )}
                  </div>
                  <div className="text-foreground/80">{g.reason}</div>
                </li>
              ))}
            </ul>
          )}

          {result.review_groups.length > 0 && (
            <ul className="text-[12px] space-y-1.5">
              {result.review_groups.map((g, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-300/30 bg-amber-300/5 px-3 py-1.5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300 text-[10px] uppercase tracking-wider font-semibold">
                      review
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.round(g.confidence * 100)}% confidence ·{' '}
                      {g.duplicate_ids.length + 1} rows
                    </span>
                  </div>
                  <div className="text-foreground/80">{g.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
