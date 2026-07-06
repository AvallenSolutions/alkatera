'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Combine,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StateChip } from '@/components/studio/state-chip';

export interface DuplicateCandidate {
  id: string;
  name: string;
  normalized_name: string;
  alkatera_org_id: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  discovered_via: string;
  similarity: number;
  /** 'exact' when normalised names match, 'fuzzy' for trgm similarity. */
  match_via: 'exact' | 'fuzzy';
  product_count: number;
}

interface Props {
  canonicalId: string;
  canonicalName: string;
  candidates: DuplicateCandidate[];
}

/**
 * Admin tool to fold a duplicate directory row into the canonical one
 * displayed on this page. Surfaces rows that share the same normalised
 * name (exact dupes after the legal-suffix + descriptor stripping) plus
 * fuzzy matches >=0.85 — the same precedence the matcher uses. The
 * admin clicks "Fold duplicate in" to merge.
 */
export function BrandMergeControl({ canonicalId, canonicalName, candidates }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mergedIds, setMergedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function merge(dupeId: string) {
    setBusyId(dupeId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${canonicalId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dupe_id: dupeId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        return;
      }
      setMergedIds((prev) => new Set(prev).add(dupeId));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setBusyId(null);
    }
  }

  const visible = candidates.filter((c) => !mergedIds.has(c.id));
  if (visible.length === 0 && mergedIds.size === 0) return null;

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Combine className="h-4 w-4 text-muted-foreground" />
          Duplicate candidates
          <span className="text-[11px] font-normal text-muted-foreground">
            {visible.length} row{visible.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These directory rows look like the same brand as {canonicalName}. Folding moves their
          products, scrape findings, listings and aliases onto this row, then deletes the
          duplicate.
        </p>
      </div>

      {mergedIds.size > 0 && visible.length === 0 && (
        <div className="rounded-[6px] border border-border bg-secondary px-3 py-2 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-studio-good shrink-0" />
          <span>
            {mergedIds.size} duplicate{mergedIds.size === 1 ? '' : 's'} merged in.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-[6px] border border-border bg-secondary px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-studio-stale shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-[6px] border border-border bg-secondary px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/admin/directory/brands/${c.id}`}
                    className="text-sm font-medium hover:underline truncate inline-flex items-center gap-1"
                  >
                    {c.name}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <Pill tone={c.verification_status === 'verified' ? 'verified' : 'pending'}>
                    {c.verification_status}
                  </Pill>
                  {c.alkatera_org_id && <Pill tone="alkatera">on alkatera</Pill>}
                  <Pill tone="match">
                    {c.match_via === 'exact'
                      ? 'exact match'
                      : `${Math.round(c.similarity * 100)}% similar`}
                  </Pill>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-x-3 flex-wrap">
                  <span className="font-mono">{c.normalized_name}</span>
                  <span>{c.product_count} product{c.product_count === 1 ? '' : 's'}</span>
                  <span>via {c.discovered_via.replace(/_/g, ' ')}</span>
                </div>
              </div>
              <Button
                size="sm"
                disabled={busyId !== null}
                onClick={() => merge(c.id)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shrink-0"
              >
                {busyId === c.id ? (
                  'Folding…'
                ) : (
                  <>
                    <Combine className="h-3.5 w-3.5 mr-1.5" /> Fold in
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'verified' | 'pending' | 'alkatera' | 'match';
}) {
  const chipTone =
    tone === 'verified'
      ? ('good' as const)
      : tone === 'pending'
        ? ('attention' as const)
        : ('quiet' as const);
  return <StateChip tone={chipTone}>{children}</StateChip>;
}
