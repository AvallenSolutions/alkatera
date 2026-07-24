import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MonoTabs } from './mono-tabs';
import type { RoomTab } from './theme';

interface InkBandProps {
  /** The room's one primary action (a PillButton, usually). */
  action?: ReactNode;
  /**
   * Where to go next. In the platform this is the OTHER rooms (the room's
   * own surfaces live in the band at the top); the distributor portal
   * still passes its room's tabs.
   */
  tabs?: RoomTab[];
  /** Anything else that earns a place: a search pill, a quiet note. */
  children?: ReactNode;
  className?: string;
}

/** The ring: the studio's quiet signature. */
function Ring() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[3.5px] border-studio-cream"
    />
  );
}

/**
 * The ink band: a small black strip, sticky at the bottom. One ring,
 * one action, the room's surfaces for the thumb. Never a big block.
 */
export function InkBand({ action, tabs, children, className }: InkBandProps) {
  return (
    <div className={cn('sticky bottom-0 z-40 bg-studio-ink text-studio-cream', className)}>
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Ring />
        {action}
        {children}
        {tabs && tabs.length > 0 ? (
          // min-w-0 so a long list of rooms scrolls inside its own lane
          // instead of shouldering Rosa off the end of the band.
          <MonoTabs
            tabs={tabs}
            on="paper"
            className="ml-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_a]:flex [&_a]:h-12 [&_a]:items-center [&_a]:py-0"
          />
        ) : null}
      </div>
    </div>
  );
}
