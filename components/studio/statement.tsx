import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from './eyebrow';

interface StatementProps {
  /** Mono eyebrow above the headline, e.g. "PORTFOLIO · 746 BRANDS". */
  eyebrow?: ReactNode;
  /** One short declarative sentence, ending with a full stop. */
  headline: ReactNode;
  /** Supporting figures, right-aligned: BigNumbers over mono labels. */
  children?: ReactNode;
  className?: string;
}

/** The surface's one sentence. Say the number where there is one. */
export function Statement({ eyebrow, headline, children, className }: StatementProps) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-12 gap-y-6',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
        <h1 className="font-display text-[clamp(2.5rem,5vw,4.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          {headline}
        </h1>
      </div>
      {children ? <div className="flex shrink-0 items-end gap-10 pb-1">{children}</div> : null}
    </header>
  );
}
