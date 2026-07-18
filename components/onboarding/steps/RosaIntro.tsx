'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Short Rosa-voiced intro chip used at the top of select onboarding steps.
 * Keeps the wizard's overall layout intact — adds about 50px of vertical
 * space — but gives Rosa a presence so users connect the work they're
 * doing with the AI partner they'll meet on the hub.
 *
 * Kept deliberately lightweight: a single line of copy, dog avatar, and
 * a quiet cream panel. No interactivity beyond the visual nudge.
 */
interface Props {
  message: string
  className?: string
}

export function RosaIntro({ message, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-[6px] border border-border bg-card',
        className,
      )}
    >
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {/* Rosa is a dog; fall back to a paw glyph if the asset is missing. */}
        <Image
          src="/images/rosa-the-dog.jpg"
          alt="Rosa"
          width={36}
          height={36}
          className="object-cover"
          onError={(e) => {
            // Hide the broken image so the quiet circle shows through.
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
      <p className="text-sm text-foreground leading-relaxed pt-1">{message}</p>
    </div>
  )
}
