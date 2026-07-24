'use client'

/**
 * What a restricted person sees where a restricted surface would have been.
 *
 * Deliberately quiet: no error tone, no red, no "forbidden". Someone whose
 * organisation has decided they do not need the salary data has done nothing
 * wrong, and the screen should not read as though they have. It names the
 * section (they can see it in the URL anyway) and says who can change it —
 * and nothing about what is inside.
 *
 * Rendered inside the room shell, not over it: the band, the desk and the way
 * out all stay where they were, so the door is closed rather than the house.
 */

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { RESTRICTABLE_SECTIONS, type SectionKey } from '@/lib/access/sections'

export function SectionNoAccess({ section }: { section: SectionKey }) {
  const { label } = RESTRICTABLE_SECTIONS[section]

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[6px] border border-studio-hairline bg-background p-9">
        <div className="mb-5 flex items-center gap-2.5">
          <Lock className="h-3.5 w-3.5 text-studio-dim" aria-hidden />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            {label}
          </p>
        </div>
        <h1 className="mb-3 font-display text-3xl font-bold tracking-tight text-foreground">
          Not yours to see.
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          An owner or administrator of your organisation has kept this section
          private. If you need it for your work, ask them to switch it back on
          for you in Team settings.
        </p>
        <Link
          href="/desk/"
          className="inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Back to the desk
        </Link>
      </div>
    </div>
  )
}
