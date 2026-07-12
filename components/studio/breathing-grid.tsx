'use client';

import { Children, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BreathingGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * The breathing grid: the hovered track re-weights from 1fr to 1.85fr and
 * its neighbours give way, over 450ms on the studio ease. Space itself
 * moves; nothing bounces and nothing spins. Stacks on small screens,
 * and a dense grid (five or more blocks) wraps to three columns until
 * the viewport is wide enough for one row. Holds still under
 * prefers-reduced-motion.
 */
export function BreathingGrid({ children, className }: BreathingGridProps) {
  const items = Children.toArray(children);
  const dense = items.length >= 5;
  const [hovered, setHovered] = useState<number | null>(null);
  const [wide, setWide] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const wideQuery = window.matchMedia(dense ? '(min-width: 1280px)' : '(min-width: 768px)');
    const stillQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setWide(wideQuery.matches);
      setStill(stillQuery.matches);
    };
    update();
    wideQuery.addEventListener('change', update);
    stillQuery.addEventListener('change', update);
    return () => {
      wideQuery.removeEventListener('change', update);
      stillQuery.removeEventListener('change', update);
    };
  }, [dense]);

  const breathes = wide && !still;
  const template = items
    .map((_, i) => (breathes && hovered === i ? '1.85fr' : '1fr'))
    .join(' ');

  return (
    <div
      className={cn(
        'studio-breathing grid gap-4 max-md:grid-cols-1',
        dense ? 'md:max-xl:grid-cols-3' : undefined,
        'md:transition-[grid-template-columns] md:duration-[450ms] md:ease-studio',
        className
      )}
      style={wide ? { gridTemplateColumns: template } : undefined}
    >
      {items.map((child, i) => (
        <div
          key={i}
          className="min-w-0"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((current) => (current === i ? null : current))}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
