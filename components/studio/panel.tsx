import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  /** Removes the default padding for flush content like tables. */
  flush?: boolean;
  className?: string;
}

/** Cream on paper: 1px hairline, radius 6, no shadow. Hairlines, not boxes. */
export function Panel({ children, flush = false, className }: PanelProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-studio-hairline bg-studio-cream',
        !flush && 'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}
