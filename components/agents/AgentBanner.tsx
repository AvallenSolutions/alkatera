'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Dog, ArrowRight } from 'lucide-react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'

interface Props {
  /** What the agent kind covers; used to count relevant open exceptions. */
  kinds: string[]
  /** Short label for the form this is sitting above. */
  formName: string
}

/**
 * Banner that sits above the heaviest data-entry forms (water, waste, direct
 * energy, supplier impact). Tells users that Rosa handles this data
 * automatically now; the form is still here as a fallback.
 *
 * Standard for every org — no longer gated behind managed_footprint_enabled
 * (that was a pilot flag; the queue is standard now).
 */
export function AgentBanner({ kinds, formName }: Props) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = async () => {
      const { count } = await supabase
        .from('agent_exceptions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'open')
        .in('kind', kinds)
      if (cancelled) return
      setOpenCount(count || 0)
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orgId, kinds.join('|')])

  return (
    <div className="rounded-[6px] border border-border bg-card p-3 mb-4">
      <div className="flex items-start gap-3">
        <Dog className="mt-0.5 h-5 w-5 flex-shrink-0 text-room-accent" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Rosa handles {formName}</p>
          <p className="text-muted-foreground mt-0.5">
            Forward bills or drop documents and Rosa ingests them, queues
            anything needing your sign-off, and writes the rest straight
            through. This form stays here as a fallback for manual edits.
          </p>
        </div>
        <Link
          href="/rosa/?tab=queue"
          className="flex flex-shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {openCount > 0 ? `${openCount} in queue` : 'Open queue'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
