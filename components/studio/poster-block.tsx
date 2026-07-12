import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Mark } from './mark';
import { ON_COLOUR_RGB, type MarkShape } from './theme';

interface PosterBlockProps {
  /** Mono eyebrow at the top, e.g. "TODAY". */
  eyebrow: string;
  /** The block's one statement, full stop included. */
  headline: ReactNode;
  /** Quiet line at the bottom, e.g. a live count. */
  note?: ReactNode;
  /** An action pinned bottom-right (e.g. a PillButton). */
  action?: ReactNode;
  href?: string;
  /** Saturated fill. Defaults to the current room's colour. */
  colour?: string;
  /** Text on colour is cream or ink only; ochre must take ink. */
  on?: 'cream' | 'ink';
  mark?: MarkShape;
  className?: string;
  /** DOM id — lets the first-visit desk tour (desk-welcome.tsx) find and scroll to this block. */
  id?: string;
}

/**
 * The one saturated block a surface is allowed. When a colour speaks,
 * it means something: never place two posters on the same surface.
 */
export function PosterBlock({
  eyebrow,
  headline,
  note,
  action,
  href,
  colour,
  on = 'cream',
  mark,
  className,
  id,
}: PosterBlockProps) {
  const content = (
    <>
      {mark ? <Mark shape={mark} tone="poster" /> : null}
      <div className="relative z-10 flex h-full flex-col">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] opacity-80">
          {eyebrow}
        </div>
        <div className="mt-3 break-words font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">
          {headline}
        </div>
        {(note || action) && (
          <div className="mt-auto flex items-end justify-between gap-4 pt-6">
            {note ? (
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-80">
                {note}
              </div>
            ) : (
              <span />
            )}
            {action}
          </div>
        )}
      </div>
    </>
  );

  const style = {
    ...(colour ? { backgroundColor: colour } : undefined),
    color: `rgb(${ON_COLOUR_RGB[on]})`,
  };

  const classes = cn(
    'group relative block min-h-[9rem] overflow-hidden rounded-[6px] p-5 transition-transform duration-200 ease-studio',
    !colour && 'bg-room',
    href && 'cursor-pointer',
    className
  );

  if (href) {
    return (
      <Link id={id} href={href} className={classes} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div id={id} className={classes} style={style}>
      {content}
    </div>
  );
}
