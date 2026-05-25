'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PendingBrand {
  id: string;
  name: string;
  category: string | null;
  country_of_origin: string | null;
  website: string | null;
  discovered_via: string;
  completeness_score: number | null;
  product_count: number;
  created_at: string;
  /** Active scraped_brand_data rows attached to this directory entry. */
  scraped_field_count: number;
  /** Latest admin-intake scrape job status — null if none has fired. */
  scrape_status: 'queued' | 'running' | 'complete' | 'error' | 'skipped' | null;
}

export function ReviewQueue({ initialBrands }: { initialBrands: PendingBrand[] }) {
  const router = useRouter();
  const [brands, setBrands] = useState<PendingBrand[]>(initialBrands);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyOn, setSafetyOn] = useState(true);

  const visibleIds = brands.map((b) => b.id);
  const safeIds = brands
    .filter((b) => isSafeToBulkVerify(b))
    .map((b) => b.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === brands.length ? new Set() : new Set(brands.map((b) => b.id)),
    );
  }

  async function decide(id: string, status: 'verified' | 'rejected') {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${id}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Failed (${j.error ?? res.status})`);
        return;
      }
      setBrands((prev) => prev.filter((b) => b.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function bulk(status: 'verified' | 'rejected', overrideIds?: string[]) {
    const ids = overrideIds ?? Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/directory/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_ids: ids, status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Bulk failed (${j.error ?? res.status})`);
        return;
      }
      const idSet = new Set(ids);
      setBrands((prev) => prev.filter((b) => !idSet.has(b.id)));
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  async function verifyAllSafe() {
    const target = safetyOn ? safeIds : visibleIds;
    if (target.length === 0) return;
    await bulk('verified', target);
  }

  if (brands.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
        <ShieldCheck className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
        <div className="text-sm font-semibold">Queue clear</div>
        <div className="text-xs text-muted-foreground mt-1">
          No brands awaiting review. New scraped or uploaded brands appear here before going
          live in Discover.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === brands.length && brands.length > 0}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-border/60 bg-background/40 text-neon-lime focus:ring-neon-lime"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || bulkBusy}
            onClick={() => bulk('rejected')}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {bulkBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Reject selected
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || bulkBusy}
            onClick={() => bulk('verified')}
            className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold"
          >
            {bulkBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Verify selected
          </Button>
          <div className="h-5 w-px bg-border/60 mx-1" />
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={safetyOn}
              onChange={(e) => setSafetyOn(e.target.checked)}
              className="h-3 w-3 rounded border-border/60 bg-background/40 text-neon-lime focus:ring-neon-lime"
            />
            Require website scrape or ≥2 sources
          </label>
          <Button
            size="sm"
            disabled={bulkBusy || (safetyOn ? safeIds.length === 0 : visibleIds.length === 0)}
            onClick={verifyAllSafe}
            className="bg-neon-lime/90 hover:bg-neon-lime text-black font-semibold"
            title={
              safetyOn
                ? `Verify ${safeIds.length} brand(s) that pass the safety check`
                : `Verify all ${visibleIds.length} visible brand(s)`
            }
          >
            {bulkBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Verify {safetyOn ? safeIds.length : visibleIds.length} visible
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {brands.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3"
          >
            <input
              type="checkbox"
              checked={selected.has(b.id)}
              onChange={() => toggle(b.id)}
              className="h-3.5 w-3.5 rounded border-border/60 bg-background/40 text-neon-lime focus:ring-neon-lime shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/directory/brands/${b.id}`}
                  className="text-sm font-medium hover:text-neon-lime truncate"
                >
                  {b.name}
                </Link>
                {b.website && (
                  <a
                    href={b.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground/60 hover:text-neon-lime shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{b.category ?? 'uncategorised'}</span>
                {b.country_of_origin && <span>{b.country_of_origin}</span>}
                <span>{b.product_count} product{b.product_count === 1 ? '' : 's'}</span>
                <span className="text-muted-foreground/60">via {b.discovered_via.replace(/_/g, ' ')}</span>
                <RichnessPills brand={b} />
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === b.id}
                onClick={() => decide(b.id, 'rejected')}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 h-8 px-2"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                disabled={busyId === b.id}
                onClick={() => decide(b.id, 'verified')}
                className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold h-8 px-2"
                title="Verify"
              >
                {busyId === b.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function isSafeToBulkVerify(b: PendingBrand): boolean {
  // We treat a brand as "safe" if we have evidence beyond the LLM:
  //   - the brand-website scrape has completed (regardless of fields),
  //     because that means the site exists and was crawled, OR
  //   - we have at least two scraped fields (any source).
  // The reviewer can still flip the safety off if they want to verify
  // pure-LLM rows in bulk.
  if (b.scrape_status === 'complete') return true;
  return b.scraped_field_count >= 2;
}

function RichnessPills({ brand }: { brand: PendingBrand }) {
  const pills: Array<{ label: string; tone: 'good' | 'wait' | 'thin' | 'fail' }> = [];
  if (brand.website) pills.push({ label: 'site', tone: 'good' });
  if (brand.scrape_status === 'complete' && brand.scraped_field_count > 0) {
    pills.push({
      label: `${brand.scraped_field_count} field${brand.scraped_field_count === 1 ? '' : 's'}`,
      tone: 'good',
    });
  } else if (brand.scrape_status === 'queued' || brand.scrape_status === 'running') {
    pills.push({ label: 'scraping…', tone: 'wait' });
  } else if (brand.scrape_status === 'error') {
    pills.push({ label: 'scrape failed', tone: 'fail' });
  } else if (!brand.website) {
    pills.push({ label: 'name only', tone: 'thin' });
  }
  return (
    <>
      {pills.map((p) => (
        <span
          key={p.label}
          className={`text-[10px] rounded-full border px-1.5 py-0.5 ${
            p.tone === 'good'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : p.tone === 'wait'
                ? 'bg-sky-400/10 border-sky-400/30 text-sky-300'
                : p.tone === 'fail'
                  ? 'bg-amber-300/10 border-amber-300/30 text-amber-300'
                  : 'bg-muted/40 border-border/60 text-muted-foreground'
          }`}
        >
          {p.label}
        </span>
      ))}
    </>
  );
}
