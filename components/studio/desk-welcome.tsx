'use client';

/**
 * Desk welcome — a first-visit guide to the house of rooms.
 *
 * User-testing feedback: after arrival onboarding, the desk lands the user
 * on seven colour blocks with no idea what they mean. This is the fix: a
 * slim band on the FIRST desk visit only (rooms.desk.introSeen falsy, and
 * the onboarding wizard not currently open), offering a quiet step-through
 * of the poster blocks in the user's persona desk order — the wiki tour's
 * interaction model (components/wiki/WikiMapClient.tsx TOURS), scaled down.
 *
 * Anchoring: each PosterBlock on the desk carries `id="desk-poster-<room>"`
 * (app/(authenticated)/desk/page.tsx). The tour finds the DOM node by id,
 * scrolls it into view and adds `.desk-tour-highlight` (a hairline ring,
 * app/globals.css) — no ref registry, no dark overlay.
 *
 * Persistence: markRoomIntroSeen('desk') fires only when the user finishes
 * the tour or dismisses the welcome band — never on a silent page-away —
 * so it never auto-shows again once they've actually acted on it.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { useOrganization } from '@/lib/organizationContext';
import { useUserRole } from '@/lib/rosa/useUserRole';
import { trackOnboarding } from '@/lib/onboarding/telemetry';
import { ROOM_GUIDES } from '@/lib/onboarding/room-guides';
import { PLATFORM_ROOMS, deskOrderForPersona, type PlatformRoomKey } from './platform-rooms';
import { Panel } from './panel';
import { Eyebrow } from './eyebrow';
import { PillButton } from './pill-button';

/** "Today." -> "TODAY", "The workbench." -> "THE WORKBENCH" — matches the poster eyebrows. */
function roomEyebrow(room: PlatformRoomKey): string {
  return PLATFORM_ROOMS[room].name.replace(/\.$/, '').toUpperCase();
}

export function DeskWelcome() {
  const { currentOrganization } = useOrganization();
  const { persona } = useUserRole();
  const { state, isLoading, shouldShowOnboarding, markRoomIntroSeen } = useOnboarding();

  // The full seven-room desk order, persona-weighted, wiring last — the
  // same order the desk grid actually renders in.
  const order = useMemo(() => deskOrderForPersona(persona), [persona]);

  const introSeen = state.rooms?.desk?.introSeen ?? false;

  // Decide once, the first time we know the real saved state and whether
  // the onboarding wizard is open, so a save mid-tour can't collapse it.
  const [decided, setDecided] = useState(false);
  const [phase, setPhase] = useState<'closed' | 'welcome' | 'tour'>('closed');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isLoading || decided) return;
    setDecided(true);
    if (!introSeen && !shouldShowOnboarding) {
      setPhase('welcome');
      trackOnboarding({
        organizationId: currentOrganization?.id,
        flow: 'room_checklist',
        step: 'desk',
        event: 'view',
        meta: { kind: 'desk_welcome_seen' },
      });
    }
    // Decide exactly once per mount, as soon as the real state has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, decided, introSeen, shouldShowOnboarding]);

  // While the tour is running: scroll the current stop into view and ring
  // it. Cleanup removes the ring from the previous stop on every step.
  useEffect(() => {
    if (phase !== 'tour') return;
    const room = order[step];
    const el = document.getElementById(`desk-poster-${room}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('desk-tour-highlight');
    return () => el.classList.remove('desk-tour-highlight');
  }, [phase, step, order]);

  const finish = (kind: 'desk_welcome_dismissed' | 'desk_tour_completed') => {
    markRoomIntroSeen('desk');
    trackOnboarding({
      organizationId: currentOrganization?.id,
      flow: 'room_checklist',
      step: 'desk',
      event: kind === 'desk_welcome_dismissed' ? 'dismiss' : 'complete',
      meta: { kind },
    });
    setPhase('closed');
  };

  if (isLoading || !decided || phase === 'closed') return null;

  if (phase === 'welcome') {
    return (
      <Panel className="mb-2">
        <Eyebrow tone="dim">Your studio</Eyebrow>
        <p className="mt-2 max-w-2xl font-display text-base font-semibold text-foreground">
          This is your desk. Every colour block below is a room, and each room looks after one
          part of your sustainability picture.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <PillButton
            size="sm"
            onClick={() => {
              setStep(0);
              setPhase('tour');
            }}
          >
            Show me around.
          </PillButton>
          <button
            type="button"
            onClick={() => finish('desk_welcome_dismissed')}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            I&rsquo;ll explore myself.
          </button>
        </div>
      </Panel>
    );
  }

  // phase === 'tour'
  const room = order[step];
  const guide = ROOM_GUIDES[room];
  const atStart = step === 0;
  const atEnd = step === order.length - 1;

  return (
    <Panel className="mb-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="dim">{roomEyebrow(room)}</Eyebrow>
          <p className="mt-2 max-w-xl text-sm text-foreground">{guide?.intro}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            {step + 1} of {order.length}
          </span>
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={atStart}
            className="rounded-[6px] border border-studio-hairline p-1.5 text-studio-dim transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
            aria-label="Previous room"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(s + 1, order.length - 1))}
            disabled={atEnd}
            className="rounded-[6px] border border-studio-hairline p-1.5 text-studio-dim transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-30"
            aria-label="Next room"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => finish('desk_tour_completed')}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            Done.
          </button>
        </div>
      </div>
    </Panel>
  );
}
