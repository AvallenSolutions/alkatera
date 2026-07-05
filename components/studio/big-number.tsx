import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BigNumberProps {
  value: ReactNode;
  /** Mandatory: a big number never appears without its mono label. */
  label: string;
  tone?: 'ink' | 'room' | 'good' | 'attention' | 'stale' | 'hold';
  /** 'display' is the statement-supporting size; 'panel' fits inside cards. */
  size?: 'display' | 'panel';
  className?: string;
}

const TONE_CLASSES = {
  ink: 'text-foreground',
  room: 'text-room-accent',
  good: 'text-studio-good',
  attention: 'text-studio-attention',
  stale: 'text-studio-stale',
  hold: 'text-studio-hold',
} as const;

/** A figure over a mono label. Numbers are always tabular. */
export function BigNumber({ value, label, tone = 'ink', size = 'panel', className }: BigNumberProps) {
  return (
    <div className={className}>
      <div
        className={cn(
          'font-display font-bold leading-none tabular-nums',
          size === 'display' ? 'text-[2rem] md:text-[2.5rem]' : 'text-[1.75rem]',
          TONE_CLASSES[tone]
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-foreground opacity-70">
        {label}
      </div>
    </div>
  );
}
