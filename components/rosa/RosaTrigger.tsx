'use client'

import { Dog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRosaContext } from '@/lib/rosa/RosaContextProvider'
import { useRosaNudges } from '@/lib/rosa/useRosaNudges'

/**
 * Floating action button — Rosa's primary trigger across every page.
 * Bottom-right, dismisses to a small dog icon when the drawer is closed.
 * Hidden when the drawer is already open (the drawer itself replaces the
 * affordance).
 *
 * Keyboard shortcut ⌘ /  is wired in RosaContextProvider; this button
 * is the discoverable surface for users who don't know shortcuts.
 */
export function RosaTrigger() {
  const { isOpen, isPinned, open } = useRosaContext()
  const { count } = useRosaNudges()

  // When pinned, the drawer is always docked — no need for a floating
  // trigger. When the drawer is opened in overlay mode, the floating
  // trigger would clash with the close button.
  if (isOpen || isPinned) return null

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'group fixed bottom-6 right-6 z-30 flex items-center gap-2',
        'rounded-full bg-[#ccff00] px-4 py-3 text-black shadow-2xl',
        'hover:bg-[#b8e600] active:scale-95 transition-all',
        'border border-[#ccff00]/60 ring-1 ring-black/5',
      )}
      aria-label={count > 0 ? `Open Rosa (${count} new)` : 'Open Rosa'}
      title={
        count > 0
          ? `Ask Rosa  (${count} new · ⌘/)`
          : 'Ask Rosa  (⌘/)'
      }
    >
      <span className="relative">
        <Dog className="h-5 w-5" />
        {count > 0 && (
          <span
            className={cn(
              'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1',
              'rounded-full bg-red-500 text-white border-2 border-[#ccff00]',
              'flex items-center justify-center text-[10px] font-bold leading-none',
            )}
            aria-hidden="true"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      <span className="text-sm font-medium pr-1">
        Ask Rosa
        <span className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-mono">
          ⌘/
        </span>
      </span>
    </button>
  )
}
