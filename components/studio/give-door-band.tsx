'use client';

/**
 * "Give us anything" in the ink band, next to Ask Rosa.
 *
 * The give door used to be a panel each room mounted at the top of its
 * page: six copies of one offer, eating the best real estate on every
 * landing, and still absent from every room that did not mount it. The ink
 * band is already the platform's permanent strip — Rosa lives there on
 * every surface — so the offer lives there too: one place, always to hand,
 * no page space at all.
 *
 * The doors themselves are GiveDoorActions, shared with the panel form, so
 * the two can never drift apart.
 */

import { useEffect, useRef, useState } from 'react';
import { GiveDoorActions } from './give-door';
import { Eyebrow } from './eyebrow';

export function GiveDoorBand() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Escape closes; a click outside closes. The band sits above everything,
  // so the sheet has to tidy up after itself.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Capture phase: the dropzone's own dialog stops propagation on some
    // clicks, and this must still see them.
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="whitespace-nowrap rounded-full border border-studio-cream/25 px-3 py-1 font-display text-xs font-semibold transition-colors duration-150 ease-studio hover:border-studio-cream/60"
      >
        Give us anything
      </button>

      {open && (
        // Opens upward out of the band, on paper: the doors are page
        // content, not band chrome, and they read as themselves.
        <div className="absolute bottom-full left-0 z-50 mb-3 w-[min(26rem,calc(100vw-2rem))] rounded-[6px] border border-studio-hairline bg-studio-cream p-5 text-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
          <Eyebrow tone="dim">Give us anything</Eyebrow>
          <div className="mt-2">
            <GiveDoorActions />
          </div>
        </div>
      )}
    </div>
  );
}
