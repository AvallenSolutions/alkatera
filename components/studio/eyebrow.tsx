import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EyebrowProps {
  children: ReactNode;
  /** 'room' takes the current room's accent; 'dim' for quiet sections. */
  tone?: 'room' | 'dim' | 'inherit';
  className?: string;
}

/** Mono eyebrow: sections, tabs, number labels. Middle dots separate facts. */
export function Eyebrow({ children, tone = 'room', className }: EyebrowProps) {
  return (
    <div
      className={cn(
        'font-mono text-[10px] font-bold uppercase tracking-[0.22em]',
        tone === 'room' && 'text-room-accent',
        tone === 'dim' && 'text-studio-dim',
        className
      )}
    >
      {children}
    </div>
  );
}
