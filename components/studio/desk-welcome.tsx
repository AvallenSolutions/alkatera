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
 * The tour card itself is a floating popover (portal, fixed positioning,
 * no backdrop) that sits adjacent to the current poster block: below it by
 * preference, flipping above or beside when the viewport says no. On a
 * step change it waits for the smooth scroll to settle, then GLIDES to the
 * new block's side (~450ms, STUDIO_EASE); under prefers-reduced-motion it
 * repositions instantly. While the user scrolls or resizes, an
 * rAF-throttled listener keeps it pinned to its block with no animation.
 * Keyboard: left/right arrows step, Escape ends the tour (persisting
 * introSeen and firing the dismiss telemetry).
 *
 * Persistence: markRoomIntroSeen('desk') fires only when the user finishes
 * the tour or dismisses the welcome band — never on a silent page-away —
 * so it never auto-shows again once they've actually acted on it.
 *
 * Mounted-under-the-wizard fix: for a genuinely new user the desk page
 * mounts UNDERNEATH the arrival ritual's full-screen overlay while it's
 * still open. The decision effect below must not latch a *negative*
 * decision (phase stays 'closed', decided=true) while shouldShowOnboarding
 * is true — that would mean the welcome never gets a second chance once
 * the wizard closes, which is exactly the bug this comment is guarding
 * against. Instead it waits, and re-evaluates the moment
 * shouldShowOnboarding flips true -> false (the ritual's completeOnboarding()
 * sets state.completed synchronously, before the router.push to '/desk/',
 * so this component sees the flip whether it was already mounted under the
 * overlay or mounts fresh after the navigation). The *positive* decision
 * (phase already welcome/tour, or introSeen already true) still latches
 * exactly once, so a debounced state save mid-tour can't collapse it.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { useOrganization } from '@/lib/organizationContext';
import { useUserRole } from '@/lib/rosa/useUserRole';
import { trackOnboarding } from '@/lib/onboarding/telemetry';
import { ROOM_GUIDES } from '@/lib/onboarding/room-guides';
import { PLATFORM_ROOMS, deskOrderForPersona, type PlatformRoomKey } from './platform-rooms';
import { STUDIO_EASE } from './theme';
import { Panel } from './panel';
import { Eyebrow } from './eyebrow';
import { PillButton } from './pill-button';

/** "Today." -> "TODAY", "The workbench." -> "THE WORKBENCH" — matches the poster eyebrows. */
function roomEyebrow(room: PlatformRoomKey): string {
  return PLATFORM_ROOMS[room].name.replace(/\.$/, '').toUpperCase();
}

/** Which side of the poster block the tour card is sitting on. */
type CardPlacement = 'below' | 'above' | 'right' | 'left';

interface CardPosition {
  top: number;
  left: number;
  placement: CardPlacement;
  /** Offset of the pointer notch along the card's anchor-facing edge, px. */
  notch: number;
}

const CARD_GAP = 14; // breathing room between block and card
const EDGE_PAD = 12; // minimum distance from any viewport edge

/**
 * Viewport-edge-aware placement: below the block by preference, then
 * above, then to the right, then the left, with a clamped fallback so the
 * card never leaves the screen. Pure function of rects so it's easy to
 * reason about.
 */
function placeCard(
  anchor: DOMRect,
  card: { width: number; height: number },
  vw: number,
  vh: number,
): CardPosition {
  const clampLeft = (l: number) => Math.min(Math.max(l, EDGE_PAD), vw - card.width - EDGE_PAD);
  const clampTop = (t: number) => Math.min(Math.max(t, EDGE_PAD), vh - card.height - EDGE_PAD);
  const notchAlong = (edge: number, cardStart: number) =>
    Math.min(Math.max(edge - cardStart, 18), card.width - 28);
  const notchAlongV = (edge: number, cardStart: number) =>
    Math.min(Math.max(edge - cardStart, 18), card.height - 28);
  const anchorMidX = anchor.left + anchor.width / 2;

  if (anchor.bottom + CARD_GAP + card.height <= vh - EDGE_PAD) {
    const left = clampLeft(anchor.left);
    return { top: anchor.bottom + CARD_GAP, left, placement: 'below', notch: notchAlong(anchorMidX, left) };
  }
  if (anchor.top - CARD_GAP - card.height >= EDGE_PAD) {
    const left = clampLeft(anchor.left);
    return { top: anchor.top - CARD_GAP - card.height, left, placement: 'above', notch: notchAlong(anchorMidX, left) };
  }
  const besideTop = clampTop(anchor.top);
  const anchorMidY = Math.min(Math.max(anchor.top + anchor.height / 2, besideTop), besideTop + card.height);
  if (anchor.right + CARD_GAP + card.width <= vw - EDGE_PAD) {
    return { top: besideTop, left: anchor.right + CARD_GAP, placement: 'right', notch: notchAlongV(anchorMidY, besideTop) };
  }
  if (anchor.left - CARD_GAP - card.width >= EDGE_PAD) {
    return { top: besideTop, left: anchor.left - CARD_GAP - card.width, placement: 'left', notch: notchAlongV(anchorMidY, besideTop) };
  }
  // Nowhere fits cleanly (tiny viewport): pin below, clamped on both axes.
  const left = clampLeft(anchor.left);
  return { top: clampTop(anchor.bottom + CARD_GAP), left, placement: 'below', notch: notchAlong(anchorMidX, left) };
}

/** The notch's per-placement styling: a rotated hairline square poking out
 * of the card's anchor-facing edge, borders only on the two exposed sides. */
const NOTCH_STYLES: Record<CardPlacement, (notch: number) => CSSProperties> = {
  below: (n) => ({ top: -6, left: n, borderTopWidth: 1, borderLeftWidth: 1 }),
  above: (n) => ({ bottom: -6, left: n, borderBottomWidth: 1, borderRightWidth: 1 }),
  right: (n) => ({ left: -6, top: n, borderBottomWidth: 1, borderLeftWidth: 1 }),
  left: (n) => ({ right: -6, top: n, borderTopWidth: 1, borderRightWidth: 1 }),
};

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
    if (introSeen) {
      // Already seen — nothing to show. Safe to latch immediately.
      setDecided(true);
      return;
    }
    if (shouldShowOnboarding) {
      // The wizard is still open (mounted underneath it). Don't decide yet
      // — deciding "no" here would latch and the welcome would never show
      // once the wizard closes. Wait; this effect re-runs when
      // shouldShowOnboarding changes.
      return;
    }
    // Wizard is closed (or was never open this visit) and the intro hasn't
    // been seen — decide to show it, once, for good.
    setDecided(true);
    setPhase('welcome');
    trackOnboarding({
      organizationId: currentOrganization?.id,
      flow: 'room_checklist',
      step: 'desk',
      event: 'view',
      meta: { kind: 'desk_welcome_seen' },
    });
  }, [isLoading, decided, introSeen, shouldShowOnboarding, currentOrganization?.id]);

  // ---- Floating tour card position ----------------------------------
  // The card is a fixed-position popover pinned next to the current poster
  // block. `glide` turns the CSS top/left transition on for the one
  // animated hop per step change; scroll/resize repositioning is instant.
  const [pos, setPos] = useState<CardPosition | null>(null);
  const [glide, setGlide] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // True from the moment a step changes until the glide lands — the
  // scroll listener stays out of the way so it can't fight the animation.
  const steppingRef = useRef(false);

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tracks whether the card has been placed at least once this tour, so
  // the very first placement fades in where it belongs rather than gliding
  // in from the card's off-screen parking spot.
  const hasPosRef = useRef(false);

  /** Measure the current block + card and pin the card beside it. */
  const reposition = useCallback((withGlide: boolean) => {
    const room = order[step];
    const el = document.getElementById(`desk-poster-${room}`);
    const card = cardRef.current;
    if (!el || !card) return;
    const rect = card.getBoundingClientRect();
    setGlide(withGlide && hasPosRef.current && !prefersReducedMotion());
    setPos(placeCard(el.getBoundingClientRect(), { width: rect.width, height: rect.height }, window.innerWidth, window.innerHeight));
    hasPosRef.current = true;
  }, [order, step]);

  // While the tour is running: ring the current stop, scroll it into view,
  // wait for the smooth scroll to settle (block rect stable across a few
  // frames, capped at 1s), then glide the card to its side. Cleanup removes
  // the ring and cancels the settle-watcher on every step.
  useEffect(() => {
    if (phase !== 'tour') return;
    const room = order[step];
    const el = document.getElementById(`desk-poster-${room}`);
    if (!el) return;
    steppingRef.current = true;
    const reduced = prefersReducedMotion();
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('desk-tour-highlight');

    // Settle-watching runs on setTimeout ticks rather than rAF: browsers
    // suspend rAF completely for hidden tabs, and a user who switches away
    // mid-step would otherwise come back to a card that never landed.
    // Timers are merely throttled (~1s) when hidden, so the 1s elapsed cap
    // below still guarantees a placement.
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let landTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTop: number | null = null;
    let stableTicks = 0;
    const startedAt = performance.now();
    const watchSettle = () => {
      const top = el.getBoundingClientRect().top;
      if (lastTop !== null && Math.abs(top - lastTop) < 0.5) stableTicks += 1;
      else stableTicks = 0;
      lastTop = top;
      if (stableTicks >= 3 || performance.now() - startedAt > 1000) {
        reposition(true); // instant under reduced motion (reposition checks)
        // Release the pinning watcher once the glide has landed.
        landTimer = setTimeout(() => { steppingRef.current = false; }, reduced ? 0 : 500);
        return;
      }
      settleTimer = setTimeout(watchSettle, 50);
    };
    settleTimer = setTimeout(watchSettle, 50);

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      if (landTimer) clearTimeout(landTimer);
      el.classList.remove('desk-tour-highlight');
    };
  }, [phase, step, order, reposition]);

  // Keep the card pinned to its block while the user scrolls or the layout
  // shifts (the desk's counts load late and nudge the grid). A per-frame
  // rAF watcher compares the block's rect with the last seen one and
  // repositions instantly when it moves — one getBoundingClientRect per
  // frame for the tour's lifetime, no animation, paused during the step
  // glide. Deliberately not a scroll listener: the desk scrolls inside a
  // <main> overflow container, and rect-watching also catches resizes and
  // content-driven layout shifts that scroll events would miss.
  useEffect(() => {
    if (phase !== 'tour') return;
    let rafId = 0;
    let last: { top: number; left: number } | null = null;
    const watch = () => {
      rafId = requestAnimationFrame(watch);
      if (steppingRef.current) { last = null; return; }
      // Self-heal: if the step effect's settle pass was missed (e.g. the
      // tab was hidden, which suspends everything), place the card as soon
      // as frames resume.
      if (!hasPosRef.current) { reposition(false); return; }
      const room = order[step];
      const el = document.getElementById(`desk-poster-${room}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (last && (Math.abs(rect.top - last.top) > 0.5 || Math.abs(rect.left - last.left) > 0.5)) {
        reposition(false);
      }
      last = { top: rect.top, left: rect.left };
    };
    rafId = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(rafId);
  }, [phase, step, order, reposition]);

  // Reset the card position whenever the tour closes so a re-run (via the
  // welcome band in the same mount) starts fresh.
  useEffect(() => {
    if (phase !== 'tour') {
      setPos(null);
      hasPosRef.current = false;
    }
  }, [phase]);

  const finish = useCallback((kind: 'desk_welcome_dismissed' | 'desk_tour_dismissed' | 'desk_tour_completed') => {
    markRoomIntroSeen('desk');
    trackOnboarding({
      organizationId: currentOrganization?.id,
      flow: 'room_checklist',
      step: 'desk',
      event: kind === 'desk_tour_completed' ? 'complete' : 'dismiss',
      meta: { kind },
    });
    setPhase('closed');
  }, [markRoomIntroSeen, currentOrganization?.id]);

  // Keyboard while the tour is open: left/right arrows step through the
  // rooms, Escape ends the tour (persists introSeen, dismiss telemetry).
  useEffect(() => {
    if (phase !== 'tour') return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Leave typing alone: arrows must not hijack the caret in the Ask
      // Rosa bar or any other field while the tour happens to be open.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, order.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStep((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish('desk_tour_dismissed');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, order.length, finish]);

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

  // phase === 'tour' — a floating popover pinned beside the current block.
  const room = order[step];
  const guide = ROOM_GUIDES[room];
  const atStart = step === 0;
  const atEnd = step === order.length - 1;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Desk tour"
      className="fixed z-[70] w-[340px] max-w-[calc(100vw-24px)]"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
        transition: glide
          ? `top 450ms ${STUDIO_EASE}, left 450ms ${STUDIO_EASE}, opacity 300ms ease`
          : 'opacity 300ms ease',
      }}
    >
      <Panel className="shadow-none">
        <Eyebrow tone="dim">{roomEyebrow(room)}</Eyebrow>
        <p className="mt-2 text-sm text-foreground">{guide?.intro}</p>
        <div className="mt-4 flex items-center gap-3">
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
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline"
          >
            Done.
          </button>
        </div>
      </Panel>
      {/* The pointer notch: rendered after the Panel so its unbordered half
          paints over the card's hairline, leaving a clean open joint — the
          classic tooltip-arrow trick. */}
      {pos && (
        <div
          aria-hidden="true"
          className="absolute h-3 w-3 rotate-45 border-0 border-solid border-studio-hairline bg-studio-cream"
          style={NOTCH_STYLES[pos.placement](pos.notch)}
        />
      )}
    </div>,
    document.body,
  );
}
