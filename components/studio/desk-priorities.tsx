'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Eyebrow } from './eyebrow';
import { StateChip } from './state-chip';
import type { WorkingTone } from './theme';

interface CuratedTile {
  id: string;
  value: string;
  unit: string | null;
  title: string;
  hint: string;
  href: string | null;
  tone: 'urgent' | 'warn' | 'info' | 'good';
}

/** Curator tone → studio working tone (states are typographic). */
const TONE: Record<CuratedTile['tone'], WorkingTone> = {
  urgent: 'stale',
  warn: 'attention',
  info: 'quiet',
  good: 'good',
};

const TONE_WORD: Record<CuratedTile['tone'], string> = {
  urgent: 'NOW',
  warn: 'SOON',
  info: 'FYI',
  good: 'ON TRACK',
};

/**
 * What needs you today: Rosa's top few priorities as a quiet cream panel
 * on the desk. The fuller tile view lives on the brief; here it stays a
 * calm fact list so the room posters keep the surface's one colour.
 */
export function DeskPriorities({ limit = 3 }: { limit?: number }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [tiles, setTiles] = useState<CuratedTile[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const params = new URLSearchParams({ organization_id: orgId, auto: '1' });
    fetch(`/api/rosa/priority-tiles?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.tiles) setTiles(data.tiles as CuratedTile[]);
      })
      .catch(() => {
        // The desk stays quiet if priorities are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!tiles || tiles.length === 0) return null;
  const shown = tiles.slice(0, limit);

  return (
    <section className="rounded-[6px] border border-border bg-card p-5 md:p-6">
      <Eyebrow className="mb-4 text-room-accent">What needs you today</Eyebrow>
      <ul className="divide-y divide-border">
        {shown.map((tile) => {
          const row = (
            <div className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="truncate font-display text-sm font-semibold text-foreground">
                    {tile.title}
                  </span>
                  <StateChip tone={TONE[tile.tone]}>{TONE_WORD[tile.tone]}</StateChip>
                </div>
                {tile.hint ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{tile.hint}</p>
                ) : null}
              </div>
              {tile.value ? (
                <span className="shrink-0 font-display text-lg font-bold tabular-nums text-foreground">
                  {tile.value}
                  {tile.unit ? (
                    <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {tile.unit}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {tile.href ? (
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-studio group-hover:translate-x-0.5 group-hover:text-room-accent"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
          return (
            <li key={tile.id}>
              {tile.href ? (
                <Link href={tile.href} className="group block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
