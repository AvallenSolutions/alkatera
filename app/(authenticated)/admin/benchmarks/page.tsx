'use client';

/**
 * Admin: internal benchmarks — the shape of our own data.
 *
 * Phase 2 of the internal-benchmarks plan. We look at the cohort BEFORE
 * anybody is scored against it, which means two things this page has to do
 * that no customer surface may:
 *
 *   1. Show buckets that do not clear the k-anonymity floor. A bucket of three
 *      businesses is exactly what we need to see to know how far off we are,
 *      and exactly what must never leave this page.
 *
 *   2. Set every qualifying bucket against the literature row it would
 *      replace. That comparison is the only cheap guard against circularity:
 *      if the engine carries a systematic bias, benchmarking customers against
 *      each other hides it perfectly, because both sides carry the same error.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { Eyebrow } from '@/components/studio/eyebrow';
import { useToast } from '@/hooks/use-toast';
import { packFormatLabel } from '@/lib/benchmarks/pack-format';
import type { LiteratureComparison } from '@/lib/benchmarks/literature-check';

interface Bucket {
  bucket_kind: 'category_format' | 'category';
  metric_key: string;
  category_group: string | null;
  system_boundary: string;
  pack_format: string | null;
  sample_size: number;
  organization_count: number;
  p25: number;
  p50: number;
  p75: number;
  mean_value: number;
  clears_k_anonymity: boolean;
}

interface Payload {
  minimum_cohort: number;
  coverage: {
    snapshot_rows: number;
    completed_pcfs: number;
    last_snapshot_date: string | null;
  };
  buckets: Bucket[];
  literature_checks: LiteratureComparison[];
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data?.session?.access_token ?? ''}` };
}

const kg = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(2);

function bucketName(b: Bucket): string {
  const group = b.category_group ?? 'Uncategorised';
  const format = packFormatLabel(b.pack_format);
  return format ? `${group}, ${format}` : group;
}

const VERDICT_TONE: Record<LiteratureComparison['verdict'], 'good' | 'stale' | 'quiet'> = {
  agrees: 'good',
  'ours-lower': 'stale',
  'ours-higher': 'stale',
  'not-comparable': 'quiet',
  'no-literature-row': 'quiet',
};

const VERDICT_LABEL: Record<LiteratureComparison['verdict'], string> = {
  agrees: 'Agrees',
  'ours-lower': 'We read lower',
  'ours-higher': 'We read higher',
  'not-comparable': 'Not comparable',
  'no-literature-row': 'Nothing to check against',
};

export default function BenchmarksAdminPage() {
  const { toast } = useToast();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/benchmarks', { headers: await authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load benchmark buckets');
      }
      setPayload(await res.json());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load benchmark buckets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const backfill = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/benchmarks', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backfill' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to start the backfill');
      }
      toast({
        title: 'Backfill started',
        description: 'Reading every completed footprint into the cohort. Refresh in a minute.',
      });
    } catch (e: unknown) {
      toast({
        title: 'Could not start the backfill',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const qualifying = (payload?.buckets ?? []).filter((b) => b.clears_k_anonymity);
  const belowFloor = (payload?.buckets ?? []).filter((b) => !b.clears_k_anonymity);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Internal benchmarks." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          Per-litre intensity from our own completed footprints, bucketed by category, system
          boundary and pack format. A bucket is only offered to a customer once it holds{' '}
          {payload?.minimum_cohort ?? 5} distinct businesses. This page shows the ones that do
          not, because we cannot judge the benchmark without seeing how far off it is.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          These businesses are alkatera customers, not a sample of the drinks sector. Expect the
          cohort to be doing better than the sector, and never label it an industry average.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-studio-dim">
          <span>
            Cohort rows{' '}
            <span className="font-medium tabular-nums text-foreground">
              {payload?.coverage.snapshot_rows ?? '—'}
            </span>
          </span>
          <span>
            Completed footprints{' '}
            <span className="font-medium tabular-nums text-foreground">
              {payload?.coverage.completed_pcfs ?? '—'}
            </span>
          </span>
          <span>
            Last written{' '}
            <span className="font-medium text-foreground">
              {payload?.coverage.last_snapshot_date ?? 'never'}
            </span>
          </span>
        </div>
        <div className="flex gap-2">
          <PillButton variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </PillButton>
          <PillButton onClick={backfill} disabled={running}>
            {running ? 'Starting…' : 'Backfill from completed footprints'}
          </PillButton>
        </div>
      </div>

      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      ) : (
        <>
          {/* ── Step 5 ──────────────────────────────────────────────────── */}
          <Panel>
            <Eyebrow>THE CHECK AGAINST OUTSIDE DATA</Eyebrow>
            <p className="mt-2 text-sm text-studio-dim">
              Every qualifying bucket set against the published figure it would replace. Large
              divergence is a finding either way: it either impugns the published row, or it
              reveals a modelling error of our own. This is the only cheap guard we have, because
              a cohort compared against itself cannot reveal a bias both sides share.
            </p>
            <div className="mt-4 space-y-3">
              {(payload?.literature_checks ?? []).length === 0 ? (
                <p className="text-sm text-studio-dim">
                  No bucket has reached {payload?.minimum_cohort ?? 5} businesses yet, so there is
                  nothing to check. Until one does, the literature table is still doing the work.
                </p>
              ) : (
                payload!.literature_checks.map((c, i) => (
                  <div key={i} className="border-t border-studio-hairline pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-foreground">
                        {c.category_group ?? 'Uncategorised'}
                        {c.pack_format ? `, ${packFormatLabel(c.pack_format) ?? c.pack_format}` : ''}
                        <span className="font-normal text-studio-dim"> · {c.system_boundary}</span>
                      </span>
                      <StateChip tone={VERDICT_TONE[c.verdict]}>{VERDICT_LABEL[c.verdict]}</StateChip>
                    </div>
                    <p className="mt-1 text-xs text-studio-dim">{c.finding}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-studio-dim">
                      <span>
                        Ours <span className="tabular-nums text-foreground">{kg(c.peer_p50)}</span>
                      </span>
                      <span>
                        Published{' '}
                        <span className="tabular-nums text-foreground">{kg(c.literature_value)}</span>
                      </span>
                      {c.literature_source && <span>{c.literature_source}</span>}
                      {c.literature_source_supports && c.literature_source_supports !== 'yes' && (
                        <span className="text-studio-stale">
                          citation support: {c.literature_source_supports}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {/* ── Buckets ─────────────────────────────────────────────────── */}
          <BucketTable
            title="Ready to use"
            hint={`These clear the ${payload?.minimum_cohort ?? 5}-business floor and are what the ladder reads.`}
            buckets={qualifying}
            tone="good"
          />
          <BucketTable
            title="Not yet"
            hint="Below the floor. Visible here and nowhere else. No customer is scored against these."
            buckets={belowFloor}
            tone="quiet"
          />
        </>
      )}
    </div>
  );
}

function BucketTable({
  title,
  hint,
  buckets,
  tone,
}: {
  title: string;
  hint: string;
  buckets: Bucket[];
  tone: 'good' | 'quiet';
}) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-studio-dim">{hint}</p>
        </div>
        <StateChip tone={tone}>{buckets.length}</StateChip>
      </div>

      {buckets.length === 0 ? (
        <p className="mt-4 text-sm text-studio-dim">Nothing here.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-studio-dim">
              <tr className="border-b border-studio-hairline">
                <th className="py-2 pr-3 font-normal">Bucket</th>
                <th className="py-2 pr-3 font-normal">Boundary</th>
                <th className="py-2 pr-3 text-right font-normal">Products</th>
                <th className="py-2 pr-3 text-right font-normal">Businesses</th>
                <th className="py-2 pr-3 text-right font-normal">p25</th>
                <th className="py-2 pr-3 text-right font-normal">p50</th>
                <th className="py-2 text-right font-normal">p75</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i} className="border-b border-studio-hairline/60 last:border-0">
                  <td className="py-2 pr-3 text-foreground">
                    {bucketName(b)}
                    <span className="ml-1 text-studio-dim">
                      {b.bucket_kind === 'category_format' ? '(like-for-like)' : '(category)'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-studio-dim">{b.system_boundary}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{b.sample_size}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                    {b.organization_count}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-studio-dim">{kg(b.p25)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{kg(b.p50)}</td>
                  <td className="py-2 text-right tabular-nums text-studio-dim">{kg(b.p75)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-studio-dim">
            kg CO2e per litre. No minimum or maximum is shown, here or anywhere: a cohort extreme
            is one identifiable product&apos;s exact footprint however many businesses are in the
            bucket.
          </p>
        </div>
      )}
    </Panel>
  );
}
