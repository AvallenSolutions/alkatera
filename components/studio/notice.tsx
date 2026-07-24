import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { WorkingTone } from './theme';

const TONE_RULE: Record<WorkingTone, string> = {
  good: 'border-studio-good',
  attention: 'border-studio-attention',
  stale: 'border-studio-stale',
  hold: 'border-studio-hold',
  quiet: 'border-studio-hairline',
};

/**
 * Something the reader needs told, on a working-tone rule.
 *
 * The old surfaces said this with a tinted card: amber background, amber
 * border, amber heading, amber body, an amber icon. Five carriers of one bit
 * of information, and a block of colour loud enough to outrank the figures it
 * was commenting on. A 2px rule in the working tone says the same thing and
 * lets the numbers stay the loudest thing on the page.
 */
export function Notice({
  tone = 'quiet',
  title,
  children,
  className,
}: {
  tone?: WorkingTone;
  /** Short bold lead-in. Omit when the body says it on its own. */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-l-2 pl-3', TONE_RULE[tone], className)}>
      {title ? (
        <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      ) : null}
      <div className={cn('text-sm leading-relaxed text-muted-foreground', title && 'mt-0.5')}>
        {children}
      </div>
    </div>
  );
}
