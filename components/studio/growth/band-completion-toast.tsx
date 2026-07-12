'use client';

/**
 * The band-completion moment: a one-time, quiet acknowledgement when a
 * growth band crosses its own completion threshold (see
 * lib/desk/growth-score.ts, GROWTH_WEIGHTS). The forest already grows when
 * this happens — this is just the studio saying so, once, in plain words.
 *
 * Auto-fades on its own; there is no dismiss control because there is
 * nothing to manage. See growth-field-mount.tsx for the detection logic
 * (a localStorage snapshot keyed alongside the forest replay).
 */

import { useEffect, useState } from 'react';
import type { GrowthBandKey } from '@/lib/desk/growth-score';

/** Plain-language, one sentence per band, always ending "The forest grew." */
const BAND_COMPLETION_COPY: Record<GrowthBandKey, string> = {
  foundations: 'Your foundations are complete. The forest grew.',
  production: 'Your production is complete. The forest grew.',
  measurement: 'Your measurement is complete. The forest grew.',
  network: 'Your network is complete. The forest grew.',
  evidence: 'Your evidence is complete. The forest grew.',
  stewardship: 'Your stewardship is complete. The forest grew.',
};

const VISIBLE_MS = 5000;
const FADE_MS = 800;

export function BandCompletionToast({
  band,
  onDone,
}: {
  band: GrowthBandKey;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    const remove = window.setTimeout(onDone, VISIBLE_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
    // Runs once for the band this instance was mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-6 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[6px] border border-studio-hairline bg-studio-cream px-5 py-4 text-center transition-opacity ease-studio"
      style={{ transitionDuration: `${FADE_MS}ms`, opacity: visible ? 1 : 0 }}
    >
      <p className="font-display text-sm font-semibold text-studio-ink">
        {BAND_COMPLETION_COPY[band]}
      </p>
    </div>
  );
}
