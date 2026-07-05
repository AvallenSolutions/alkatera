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
 * moves; nothing bounces and nothing spins. Stacks on small screens and
 * holds still under prefers-reduced-motion.
 */
export function BreathingGrid({ children, className }: BreathingGridProps) {
  const items = Children.toArray(children);
  const [hovered, setHovered] = useState<number | null>(null);
  const [breathes, setBreathes] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setBreathes(wide.matches && !still.matches);
    update();
    wide.addEventListener('change', update);
    still.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      still.removeEventListener('change', update);
    };
  }, []);

  const template = items
    .map((_, i) => (breathes && hovered === i ? '1.85fr' : '1fr'))
    .join(' ');

  return (
    <div
      className={cn(
        'studio-breathing grid gap-4 max-md:grid-cols-1',
        'md:transition-[grid-template-columns] md:duration-[450ms] md:ease-studio',
        className
      )}
      style={breathes || hovered !== null ? { gridTemplateColumns: template } : undefined}
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
