'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CoachmarkBody } from './coachmark';

export interface CoachmarkStep {
  /** Matches a `data-guide="…"` attribute on the page. Missing anchors skip. */
  anchor: string;
  /** Mono eyebrow. Defaults to "Step N of M". */
  title?: string;
  /** One or two plain sentences, in Rosa's voice. */
  body: string;
  /** An optional act offered on the step, e.g. handing over to Rosa. */
  action?: { label: string; onSelect: () => void };
}

interface CoachmarkSequenceProps {
  steps: CoachmarkStep[];
  active: boolean;
  /** Called on finish, skip or Escape. */
  onDone: () => void;
  /** Fired as each step is shown, for telemetry. */
  onStep?: (index: number) => void;
}

const CALLOUT_WIDTH = 256;
const GAP = 12;
const EDGE = 12;

/**
 * A short walk of the page, in quiet anchored callouts.
 *
 * This replaces the spotlight tour idiom: no dark scrim over the work, no
 * typewriter, no pulsing rings, and no polling loop measuring the DOM four
 * times a second. The page stays legible and clickable throughout; the only
 * emphasis is a hairline ring in the room's ink around whatever is being
 * talked about.
 *
 * It is fully controlled and persists nothing: the caller decides when a walk
 * runs and what remembering it means.
 */
export function CoachmarkSequence({ steps, active, onDone, onStep }: CoachmarkSequenceProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  // Measured rather than assumed: the callout's height depends on how long the
  // step's sentences are, and guessing it put the card on top of the very
  // thing it was pointing at.
  const [calloutHeight, setCalloutHeight] = useState(150);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (active) setIndex(0);
  }, [active]);

  const step = active ? steps[index] : undefined;

  const finish = useCallback(() => {
    setRect(null);
    onDone();
  }, [onDone]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= steps.length) {
        finish();
        return;
      }
      setIndex(next);
    },
    [steps.length, finish],
  );

  // Measure the anchor, and keep measuring while it moves: the sections around
  // it load their own data, so the page grows and shrinks under the callout.
  useLayoutEffect(() => {
    if (!step) return;

    let frame = 0;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-guide="${step.anchor}"]`);
      if (!el) {
        // Nothing to point at (a section this product does not have, or a
        // narrow screen that dropped it). Move along rather than stall.
        setRect(null);
        frame = window.requestAnimationFrame(() => goTo(index + 1));
        return;
      }
      setRect(el.getBoundingClientRect());
    };

    const el = document.querySelector<HTMLElement>(`[data-guide="${step.anchor}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    onStep?.(index);

    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
    // onStep is intentionally not a dependency: it fires once per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.anchor, index, goTo]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      else if (event.key === 'ArrowRight' || event.key === 'Enter') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, index, goTo, finish]);

  if (!active || !mounted || !step || !rect) return null;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  // Below the anchor if it fits, above if that fits instead, and otherwise
  // pinned to the foot of the screen rather than laid over the anchor: a step
  // that hides what it is describing is worse than one sitting out of the way.
  const roomBelow = viewportHeight - rect.bottom - GAP - EDGE;
  const roomAbove = rect.top - GAP - EDGE;
  const top =
    roomBelow >= calloutHeight
      ? rect.bottom + GAP
      : roomAbove >= calloutHeight
        ? rect.top - GAP - calloutHeight
        : Math.max(EDGE, viewportHeight - calloutHeight - EDGE);
  const left = Math.min(Math.max(EDGE, rect.left), Math.max(EDGE, viewportWidth - CALLOUT_WIDTH - EDGE));
  const isLast = index === steps.length - 1;

  return createPortal(
    <>
      {/* The emphasis, such as it is: a hairline ring in the room's ink. No
          scrim, so the page underneath stays readable and clickable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[60] rounded-[6px] ring-1 ring-room-accent/50 transition-all duration-200 ease-studio"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      <CoachmarkBody
        ref={(node: HTMLDivElement | null) => {
          if (node) {
            const height = node.getBoundingClientRect().height;
            if (height > 0 && Math.abs(height - calloutHeight) > 2) setCalloutHeight(height);
          }
        }}
        role="dialog"
        ariaLabel={`Step ${index + 1} of ${steps.length}`}
        title={step.title ?? `Step ${index + 1} of ${steps.length}`}
        body={step.body}
        onDismiss={finish}
        className="fixed z-[61] transition-all duration-200 ease-studio"
        style={{ top, left, width: CALLOUT_WIDTH }}
        footer={
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {step.action && (
              <button
                type="button"
                onClick={() => {
                  step.action!.onSelect();
                  finish();
                }}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent hover:opacity-70"
              >
                {step.action.label}
              </button>
            )}
            <span className="ml-auto flex items-center gap-4">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim hover:text-foreground"
                >
                  Back.
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  onClick={finish}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim hover:text-foreground"
                >
                  Skip.
                </button>
              )}
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:opacity-70"
              >
                {isLast ? 'Done.' : 'Next.'}
              </button>
            </span>
          </div>
        }
      />
    </>,
    document.body,
  );
}
