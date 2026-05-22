'use client'

import { Dog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRosaContext, type RosaSelectedEntity } from '@/lib/rosa/RosaContextProvider'

interface Props {
  /** What this button is asking about (a row, a card, a field). */
  entity: RosaSelectedEntity
  /** The prompt seeded into Rosa's input when clicked. */
  prompt: string
  /** Visual variant. Icon-only is the default for inline placements. */
  variant?: 'icon' | 'pill'
  /** Optional override label for the pill variant. */
  label?: string
  className?: string
}

/**
 * "Ask Rosa about this" — a small inline button that pins a specific
 * entity (an unmatched ingredient row, an anomaly card, a queue item)
 * into Rosa's context, opens the drawer, and seeds a prompt about it.
 *
 * Usage at the moment-of-confusion next to the relevant UI element:
 *
 *   <AskRosaButton
 *     entity={{
 *       type: 'ingredient',
 *       id: ingredient.id,
 *       label: `Ingredient: ${ingredient.name}`,
 *       data: { name: ingredient.name, amount: ingredient.amount, unit: ingredient.unit },
 *     }}
 *     prompt={`Help me pick the right emission factor for "${ingredient.name}".`}
 *   />
 */
export function AskRosaButton({
  entity,
  prompt,
  variant = 'icon',
  label,
  className,
}: Props) {
  const { selectEntity, askRosa } = useRosaContext()

  const handleClick = () => {
    selectEntity(entity)
    askRosa(prompt)
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40',
          'px-2.5 py-1 text-xs font-medium text-muted-foreground',
          'hover:border-[#ccff00]/40 hover:bg-[#ccff00]/[0.06] hover:text-foreground transition-colors',
          className,
        )}
        title="Ask Rosa about this"
      >
        <Dog className="h-3 w-3 text-[#ccff00]" />
        {label || 'Ask Rosa'}
      </button>
    )
  }

  // Icon-only (default).
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md',
        'text-muted-foreground hover:bg-[#ccff00]/15 hover:text-[#ccff00]',
        'transition-colors',
        className,
      )}
      aria-label="Ask Rosa about this"
      title="Ask Rosa about this"
    >
      <Dog className="h-4 w-4" />
    </button>
  )
}
