'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/organizationContext';
import { Eyebrow } from './eyebrow';
import { FactList } from './fact-list';
import { PillButton } from './pill-button';
import type { WorkingTone } from './theme';
import { GROWTH_WEIGHTS, type GrowthBandKey, type GrowthSignal } from '@/lib/desk/growth-score';
import { checkScoreStall } from '@/lib/desk/stall-detection';
import { supabase } from '@/lib/supabaseClient';
import type { AskAnswerShape } from '@/lib/asks/types';

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
export function DeskPriorities(props: { limit?: number }) {
  return (
    <div className="space-y-4">
      <AskOfTheDay />
      <PriorityFactList {...props} />
    </div>
  );
}

// ─── Asks lane (Pillar 3, data-revolution-plan.md) ──────────────────────────
//
// The top-impact open ask, one tap to answer. Deliberately separate from
// the curated-tiles/growth-signal fallback above: asks are real data gaps
// with a genuine write behind them, tiles/signals are narrative/navigation.
// Never more than one ask shown here — the full ordered queue lives on
// /rosa?view=queue (ExceptionQueue.tsx AskRow).
//
// growth_signal asks are excluded: they have no field to answer inline
// (answer_shape 'link') and the setup-action fallback above already covers
// the same undone-signal ground for a quiet new org — showing both would
// duplicate "Add your first facility" in two places on the same page. See
// components/studio/room-setup-panel.tsx for the equivalent guard on the
// room checklists.

interface AskRow {
  id: string;
  title: string;
  payload: {
    ask_type: string;
    question: string;
    answer_shape: AskAnswerShape;
    impact_share: number | null;
    priority_score: number;
    href?: string | null;
  };
}

function AskOfTheDay() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const router = useRouter();
  const [ask, setAsk] = useState<AskRow | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch('/api/agents/exceptions?kind=ask&status=open&limit=100', { credentials: 'include' }).catch(
      () => null,
    );
    if (!res || !res.ok) {
      setAsk(null);
      return;
    }
    const body = await res.json().catch(() => ({ exceptions: [] }));
    const top = ((body.exceptions ?? []) as AskRow[])
      .filter((e) => e.payload?.ask_type !== 'growth_signal')
      .sort((a, b) => (b.payload?.priority_score ?? -1) - (a.payload?.priority_score ?? -1))[0];
    setAsk(top ?? null);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (body: { action: 'answer'; answer: boolean } | { action: 'defer' }) => {
      if (!ask) return;
      setBusy(true);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(`/api/agents/exceptions/${ask.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        // A confirmed answer may have flipped provenance (a growth-field
        // input) — refresh both this lane and the rest of the desk's
        // server data so the forest reflects it immediately.
        await load();
        router.refresh();
      } catch {
        // Quietly leave the card as-is; the queue view is the fallback.
      } finally {
        setBusy(false);
      }
    },
    [ask, load, router],
  );
  const answer = (value: boolean) => act({ action: 'answer', answer: value });
  const notNow = () => act({ action: 'defer' });

  if (!ask) return null;
  const { question, answer_shape, impact_share, href } = ask.payload;
  const impactLine = impact_share != null ? `Worth about ${Math.round(impact_share * 100)}% of your footprint.` : null;

  return (
    <section className="rounded-[6px] border border-border bg-card p-5 md:p-6">
      <Eyebrow className="mb-4 text-room-accent">A quick question</Eyebrow>
      <p className="font-display text-sm font-semibold text-foreground">{question}</p>
      {impactLine ? <p className="mt-1 text-xs text-muted-foreground">{impactLine}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {answer_shape === 'confirm_value' ? (
          <>
            <PillButton variant="ink" size="sm" onClick={() => answer(true)} disabled={busy}>
              Confirm
            </PillButton>
            <PillButton variant="ghost" size="sm" onClick={notNow} disabled={busy}>
              Not now
            </PillButton>
          </>
        ) : answer_shape === 'yes_no' ? (
          <>
            <PillButton variant="ink" size="sm" onClick={() => answer(true)} disabled={busy}>
              Yes
            </PillButton>
            <PillButton variant="outline" size="sm" onClick={() => answer(false)} disabled={busy}>
              No
            </PillButton>
          </>
        ) : href ? (
          <PillButton variant="outline" size="sm" href={href}>
            Sort this out
          </PillButton>
        ) : null}
      </div>
    </section>
  );
}

function PriorityFactList({ limit = 3 }: { limit?: number }) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [tiles, setTiles] = useState<CuratedTile[] | null>(null);
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [stalled, setStalled] = useState(false);

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

  // Stalled-band nudge: has this org's score sat still for a fortnight?
  // Client-only comparison against a localStorage snapshot — see
  // lib/desk/stall-detection.ts. Only ever affects the setup-action
  // fallback below, and only ever nudges once.
  useEffect(() => {
    if (!orgId || growth === null) return;
    setStalled(checkScoreStall(orgId, growth.score));
  }, [orgId, growth]);

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
            items={actions.map((action, index) => ({
              id: action.id,
              title: action.label,
              // The stalled-band nudge: never more than one, and only ever
              // on the first action, so it reads as a gentle aside rather
              // than a warning.
              hint: index === 0 && stalled ? 'The forest has been quiet for a while.' : undefined,
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
