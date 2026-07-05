import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { WorkingTone } from './theme';

const TONE_CLASSES: Record<WorkingTone, string> = {
  good: 'text-studio-good',
  attention: 'text-studio-attention',
  stale: 'text-studio-stale',
  hold: 'text-studio-hold',
  quiet: 'text-studio-dim',
};

interface StateChipProps {
  tone?: WorkingTone;
  children: ReactNode;
  className?: string;
}

/**
 * States are typographic: small bold mono in a working tone. No badge
 * pills, no backgrounds; the word and its colour are enough.
 */
export function StateChip({ tone = 'quiet', children, className }: StateChipProps) {
  return (
    <span
      className={cn(
        'font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
