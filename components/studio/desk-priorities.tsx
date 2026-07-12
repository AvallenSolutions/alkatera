'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { Eyebrow } from './eyebrow';
import { FactList } from './fact-list';
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
      <FactList
        items={shown.map((tile) => ({
          id: tile.id,
          title: tile.title,
          hint: tile.hint || undefined,
          chip: { tone: TONE[tile.tone], label: TONE_WORD[tile.tone] },
          value: tile.value || undefined,
          unit: tile.unit,
          href: tile.href ?? undefined,
        }))}
      />
    </section>
  );
}
