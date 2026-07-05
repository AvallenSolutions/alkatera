'use client';

import { useRosaContext } from '@/lib/rosa/RosaContextProvider';
import { useRosaNudges } from '@/lib/rosa/useRosaNudges';
import { InkBand } from './ink-band';
import type { RoomTab } from './theme';

/**
 * The ink band, inhabited: Rosa's permanent home at the bottom of every
 * surface. One ring, one prompt, never a big block. The old lime header
 * button is retired; ⌘/ still works (wired in RosaContextProvider).
 */
export function AskRosaBand({ tabs }: { tabs?: RoomTab[] }) {
  const { isOpen, isPinned, open } = useRosaContext();
  const { count } = useRosaNudges();

  return (
    <InkBand
      tabs={tabs}
      action={
        <button
          type="button"
          onClick={open}
          disabled={isOpen || isPinned}
          className="flex min-w-0 items-center gap-3 rounded-full border border-studio-cream/25 px-3 py-1 text-left transition-colors duration-150 ease-studio hover:border-studio-cream/60 disabled:opacity-50"
          aria-label={count > 0 ? `Ask Rosa (${count} new)` : 'Ask Rosa'}
        >
          <span className="whitespace-nowrap font-display text-xs font-semibold">Ask Rosa</span>
          <span className="hidden truncate text-xs opacity-50 sm:block">
            Anything, any room…
          </span>
          {count > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-studio-brick px-1 font-mono text-[9px] font-bold leading-none text-studio-cream">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      }
    >
      <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 md:block">
        ⌘ /
      </span>
    </InkBand>
  );
}
