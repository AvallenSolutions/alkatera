'use client';

import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * Smoothly interpolate from the previous value to `target` whenever it changes.
 *
 * Uses framer-motion's `animate()` (already a dependency for the rest of the
 * dashboard) so easing matches the rest of the UI. Returns the current
 * displayed number, which the caller renders.
 *
 * @param target    The number to animate towards.
 * @param duration  Seconds to spend animating. Default 0.8.
 */
export function useAnimatedNumber(target: number, duration: number = 0.8): number {
  const [displayed, setDisplayed] = useState(target);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const controls = animate(displayed, target, {
      duration,
      ease: 'easeOut',
      onUpdate: latest => setDisplayed(latest),
    });

    return () => controls.stop();
    // We deliberately don't include `displayed` in the dep array — it would
    // restart the animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return displayed;
}
