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
}

export function ReviewQueue({ initialBrands }: { initialBrands: PendingBrand[] }) {
  const router = useRouter();
  const [brands, setBrands] = useState<PendingBrand[]>(initialBrands);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function bulk(status: 'verified' | 'rejected') {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const ids = Array.from(selected);
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

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === brands.length && brands.length > 0}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-border/60 bg-background/40 text-neon-lime focus:ring-neon-lime"
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        <div className="flex gap-2">
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
              <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                <span>{b.category ?? 'uncategorised'}</span>
                {b.country_of_origin && <span>{b.country_of_origin}</span>}
                <span>{b.product_count} product{b.product_count === 1 ? '' : 's'}</span>
                <span className="text-muted-foreground/60">via {b.discovered_via.replace(/_/g, ' ')}</span>
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
