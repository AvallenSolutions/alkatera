'use client'

import { useEffect, useState } from 'react'
import { Dog, X, Sparkles, Inbox, Upload, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'rosa_welcome_dismissed_v1'

interface Props {
  onAsk: (prompt: string) => void
  onOpenQueue?: () => void
}

/**
 * First-run welcome card explaining who Rosa is and what she can do.
 * Stored as dismissed-permanently in localStorage once the user closes it,
 * so power users don't see it on every visit. New users see it until they
 * dismiss; they can also re-open it later via the help menu (TODO).
 */
export function RosaWelcome({ onAsk, onOpenQueue }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  if (dismissed === null || dismissed === true) return null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-border bg-card p-5 sm:p-6',
      )}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex items-start gap-4">
        <div className="flex-shrink-0 rounded-[6px] bg-secondary p-2.5">
          <Dog className="h-6 w-6 text-studio-forest" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Hi, I&apos;m Rosa</h2>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            I&apos;m your sustainability companion. Drop me a document, ask me a
            question, or forward me an email and I&apos;ll handle the heavy lifting
            so you can spend less time entering data and more time acting on it.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip
              icon={<Inbox className="h-3.5 w-3.5" />}
              onClick={() => onOpenQueue?.()}
            >
              See what needs you
            </Chip>
            <Chip
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() => onAsk('Summarise my carbon footprint by scope and category for this year.')}
            >
              Show my carbon footprint
            </Chip>
            <Chip
              icon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[type=file]')
                input?.click()
              }}
            >
              Drop a utility bill
            </Chip>
            <Chip
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={() => onAsk('What are the three things I should focus on this week?')}
            >
              What should I focus on?
            </Chip>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="rounded-full border-border bg-background/40 hover:bg-secondary hover:border-studio-forest/40 text-xs h-8"
    >
      <span className="mr-1.5 text-studio-forest">{icon}</span>
      {children}
    </Button>
  )
}
