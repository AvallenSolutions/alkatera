'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Combine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StateChip } from '@/components/studio/state-chip';

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
    <div className="rounded-[6px] border border-border bg-card p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Combine className="h-4 w-4 text-muted-foreground" />
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
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {busy ? (
          'Sweeping…'
        ) : (
          <>
            <Combine className="h-4 w-4 mr-1.5" /> Dedup products
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-[6px] border border-border bg-secondary px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-studio-stale shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-[6px] border border-border bg-secondary px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-studio-good shrink-0 mt-0.5" />
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
                  className="rounded-[6px] border border-border bg-secondary px-3 py-1.5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <StateChip tone="good">merged</StateChip>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.round(g.confidence * 100)}% confidence
                    </span>
                    {g.errors.length > 0 && (
                      <span className="text-[10px] text-studio-attention">
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
                  className="rounded-[6px] border border-border bg-secondary px-3 py-1.5 flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <StateChip tone="attention">review</StateChip>
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
