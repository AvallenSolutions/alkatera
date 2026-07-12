'use client';

/**
 * Room setup panel — Phase 2 of onboarding (see tasks/onboarding-support-plan.md).
 *
 * Extends the PulseSetupChecklist / EmissionsGuide hairline-fact-row pattern
 * to every room: a first-visit intro sentence, then a compact checklist
 * drawn straight from the live growth signals (GET /api/growth) for the
 * bands that room owns (lib/onboarding/room-guides.ts). Rooms and the desk
 * priorities read the same signals, so they can never disagree.
 *
 * Renders nothing while loading, once dismissed, or once every signal in
 * the room is done. A room with no bands (the library) gets an intro-only
 * appearance: shown once, then never again.
 */

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { useRosaContext } from '@/lib/rosa/RosaContextProvider';
import { ROOM_GUIDES, ROOM_CHECKLIST_LIMIT } from '@/lib/onboarding/room-guides';
import { PLATFORM_ROOMS, type PlatformRoomKey } from './platform-rooms';
import { Panel } from './panel';
import { Eyebrow } from './eyebrow';
import { FactList, type FactRowItem } from './fact-list';
import type { GrowthBandKey, GrowthSignal } from '@/lib/desk/growth-score';

interface GrowthResponse {
  score: number;
  bands: Record<GrowthBandKey, number>;
  signals?: Record<GrowthBandKey, GrowthSignal[]>;
}

// Shared across every room panel mounted in the session — a room-to-room
// walk shouldn't recompute the same growth payload. TTL mirrors the API's
// own two-minute Cache-Control.
const growthCache = new Map<string, { data: GrowthResponse; ts: number }>();
const GROWTH_CACHE_MS = 120_000;

function useGrowthSignals(orgId: string | undefined): GrowthResponse | null {
  const [data, setData] = useState<GrowthResponse | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const cached = growthCache.get(orgId);
    if (cached && Date.now() - cached.ts < GROWTH_CACHE_MS) {
      setData(cached.data);
      return;
    }
    let cancelled = false;
    fetch(`/api/growth?organization_id=${orgId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        growthCache.set(orgId, { data: json, ts: Date.now() });
        setData(json);
      })
      .catch(() => {
        // The panel simply won't show if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return data;
}

/** "The workbench." -> "the workbench", for dropping into a Rosa prompt. */
function roomPhrase(room: PlatformRoomKey): string {
  const name = PLATFORM_ROOMS[room].name.replace(/\.$/, '');
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function RoomSetupPanel({ room }: { room: PlatformRoomKey }) {
  const { currentOrganization } = useOrganization();
  const growth = useGrowthSignals(currentOrganization?.id);
  const { state, isLoading, markRoomIntroSeen, dismissRoomChecklist } = useOnboarding();
  const { askRosa } = useRosaContext();

  const guide = ROOM_GUIDES[room];
  const introSeenSaved = state.rooms?.[room]?.introSeen ?? false;
  const checklistDismissed = state.rooms?.[room]?.checklistDismissed ?? false;

  // Decide once, the first time we know the real saved state, whether this
  // mount gets the prominent first-visit intro — and lock it in for the
  // rest of this visit so persisting introSeen doesn't collapse the panel
  // mid-read.
  const [decided, setDecided] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    if (isLoading || decided || !guide) return;
    setDecided(true);
    if (!introSeenSaved) {
      setShowIntro(true);
      markRoomIntroSeen(room);
    }
    // Runs once per mount, as soon as the real state has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, decided, guide]);

  if (!guide || isLoading || !decided) return null;

  const hasChecklist = guide.bands.length > 0;

  // Intro-only room (the library): shown once, then nothing.
  if (!hasChecklist) {
    if (!showIntro) return null;
    return (
      <Panel className="mb-8">
        <Eyebrow tone="dim">Welcome</Eyebrow>
        <p className="mt-2 font-display text-base font-semibold text-foreground">{guide.intro}</p>
      </Panel>
    );
  }

  if (checklistDismissed) return null;
  if (!growth?.signals) return null; // render nothing while the signals load

  const signals = guide.bands.flatMap((band) => growth.signals![band] ?? []);
  const undone = signals.filter((s) => !s.done);
  const done = signals.filter((s) => s.done);
  const shown = [...undone, ...done].slice(0, ROOM_CHECKLIST_LIMIT);

  if (shown.length === 0 || undone.length === 0) return null; // nothing left to set up here

  const items: FactRowItem[] = shown.map((s) => ({
    id: s.id,
    title: s.label,
    chip: s.done ? { tone: 'good' as const, label: 'Done' } : undefined,
    meta: s.done ? undefined : 'TO DO',
    href: s.href,
  }));

  return (
    <Panel className="mb-8">
      {showIntro && (
        <p className="mb-4 font-display text-base font-semibold text-foreground">{guide.intro}</p>
      )}
      <Eyebrow tone="dim">Setting up</Eyebrow>
      <FactList dense className="mt-2 border-t border-studio-hairline" items={items} />
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          {shown.length - undone.length} of {shown.length} done.
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => askRosa(`What should I do next in ${roomPhrase(room)}?`)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            Ask Rosa about this room.
          </button>
          <button
            type="button"
            onClick={() => dismissRoomChecklist(room)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            Hide this.
          </button>
        </div>
      </div>
    </Panel>
  );
}
