'use client'

import { Dog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { useRosaNudges } from '@/lib/rosa/useRosaNudges'

/**
 * Rosa's primary trigger, living in the top menu bar on every page.
 * Replaces the old bottom-right floating button (which overlapped other
 * controls). Shows a red nudge badge when Rosa has pending prompts.
 *
 * Keyboard shortcut ⌘ /  is wired in RosaContextProvider; this button is
 * the discoverable surface for users who don't know shortcuts.
 */
export function RosaHeaderButton() {
  const { isOpen, isPinned, open } = useRosaContext()
  const { count } = useRosaNudges()

  // When the drawer is already open or docked, the trigger is redundant.
  if (isOpen || isPinned) return null

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-full',
        'bg-primary px-3 py-1.5 text-primary-foreground',
        'hover:bg-primary/90 active:scale-95 transition-all',
      )}
      aria-label={count > 0 ? `Open Rosa (${count} new)` : 'Open Rosa'}
      title={count > 0 ? `Ask Rosa  (${count} new · ⌘/)` : 'Ask Rosa  (⌘/)'}
    >
      <span className="relative flex">
        <Dog className="h-4 w-4" />
        {count > 0 && (
          <span
            className={cn(
              'absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1',
              'rounded-full bg-studio-stale text-white border-2 border-primary',
              'flex items-center justify-center text-[9px] font-bold leading-none',
            )}
            aria-hidden="true"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      <span className="hidden text-sm font-medium sm:inline">Ask Rosa</span>
    </button>
  )
}
