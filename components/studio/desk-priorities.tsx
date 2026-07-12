'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { Eyebrow } from './eyebrow';
import { FactList } from './fact-list';
import type { WorkingTone } from './theme';
import { GROWTH_WEIGHTS, type GrowthBandKey, type GrowthSignal } from '@/lib/desk/growth-score';

interface CuratedTile {
  id: string;
  value: string;
  unit: string | null;
  title: string;
  hint: string;
  href: string | null;
  tone: 'urgent' | 'warn' | 'info' | 'good';
}

interface GrowthResponse {
  score: number;
  bands: Record<GrowthBandKey, number>;
  signals?: Record<GrowthBandKey, GrowthSignal[]>;
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

/** Below this score a fresh org has too little real Rosa activity to
 *  curate priorities from — the desk falls back to setup actions instead. */
const NEVER_EMPTY_SCORE_THRESHOLD = 30;

/**
 * Turn the weakest growth bands into up to `limit` plain-sentence setup
 * actions, each deep-linking to where the user can close that gap. Bands
 * are ordered by how incomplete they are (lowest points/weight first);
 * within a band, signals are taken in their declared order.
 */
function setupActionsFromSignals(
  bands: Record<GrowthBandKey, number>,
  signals: Record<GrowthBandKey, GrowthSignal[]>,
  limit: number,
): GrowthSignal[] {
  const bandOrder = (Object.keys(GROWTH_WEIGHTS) as GrowthBandKey[]).sort(
    (a, b) => bands[a] / GROWTH_WEIGHTS[a] - bands[b] / GROWTH_WEIGHTS[b],
  );
  const actions: GrowthSignal[] = [];
  // First pass: one undone signal per band, weakest band first, so the
  // three actions span different parts of the platform rather than
  // piling all three into a single band.
  for (const band of bandOrder) {
    if (actions.length >= limit) break;
    const next = (signals[band] ?? []).find((s) => !s.done);
    if (next) actions.push(next);
  }
  // Second pass: still short (a band ran out of undone signals) — fill
  // from any remaining undone signals in weakest-band order.
  if (actions.length < limit) {
    for (const band of bandOrder) {
      if (actions.length >= limit) break;
      for (const sig of signals[band] ?? []) {
        if (actions.length >= limit) break;
        if (!sig.done && !actions.includes(sig)) actions.push(sig);
      }
    }
  }
  return actions;
}

/**
 * What needs you today: Rosa's top few priorities as a quiet cream panel
 * on the desk. The fuller tile view lives on the brief; here it stays a
 * calm fact list so the room posters keep the surface's one colour.
 *
 * Never empty: a fresh org has no real Rosa priorities yet, so below the
 * never-empty score threshold (or when there simply are no tiles) this
 * reads the growth signals instead and shows plain setup actions from the
 * weakest bands — "Add your first facility." — each deep-linking into the
 * room that can close the gap.
 */
export function DeskPriorities({ limit = 3 }: { limit?: number }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [tiles, setTiles] = useState<CuratedTile[] | null>(null);
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);

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
    fetch(`/api/growth?organization_id=${orgId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setGrowth(data as GrowthResponse);
      })
      .catch(() => {
        // Setup-action fallback simply won't show if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const hasCuratedTiles = !!tiles && tiles.length > 0;
  const scoreIsLow = growth ? growth.score < NEVER_EMPTY_SCORE_THRESHOLD : false;
  const useFallback = growth?.signals && (!hasCuratedTiles || scoreIsLow);

  if (useFallback) {
    const actions = setupActionsFromSignals(growth!.bands, growth!.signals!, limit);
    if (actions.length === 0) {
      // Every signal is already done but the score/tiles haven't caught up
      // yet (or there's genuinely nothing left) — stay quiet rather than
      // show a stale or empty list.
      if (!hasCuratedTiles) return null;
    } else {
      return (
        <section className="rounded-[6px] border border-border bg-card p-5 md:p-6">
          <Eyebrow className="mb-4 text-room-accent">Get your desk started</Eyebrow>
          <FactList
            items={actions.map((action) => ({
              id: action.id,
              title: action.label,
              href: action.href,
            }))}
          />
        </section>
      );
    }
  }

  if (!hasCuratedTiles) return null;
  const shown = tiles!.slice(0, limit);

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
