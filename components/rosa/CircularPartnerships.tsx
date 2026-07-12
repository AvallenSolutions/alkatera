'use client'

/**
 * "Your circular partnerships": quiet typed fact rows on the brief
 * surfacing 1-3 active byproducts with their named partners. Click-through
 * to /byproducts/ for the full gallery.
 *
 * Hidden when the org has no active byproducts (no empty state by design;
 * empty rows add noise, producers see this only after they've registered
 * something to be proud of).
 */

import { useEffect, useState } from 'react'
import { FactRow } from '@/components/studio/fact-row'
import { getDestinationMeta, type ByproductDestinationType } from '@/lib/byproducts/destination-types'

interface ActiveByproduct {
  id: string
  name: string
  destination_type: ByproductDestinationType
  partner_name: string | null
  contract_started: string | null
}

export function CircularPartnerships() {
  const [byproducts, setByproducts] = useState<ActiveByproduct[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/byproducts?status=active', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled) return
        const items = Array.isArray(json?.byproducts) ? json.byproducts : []
        setByproducts(items.slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // No data yet → render nothing (don't bait the user with an empty CTA card).
  if (!byproducts || byproducts.length === 0) return null

  return (
    <div>
      {byproducts.map(bp => {
        const meta = getDestinationMeta(bp.destination_type)
        const label = meta?.label ?? bp.destination_type
        return (
          <FactRow
            key={bp.id}
            href="/byproducts/"
            subject={bp.name}
            detail={bp.partner_name ? `${bp.partner_name} · ${label}` : label}
            meta="BYPRODUCT"
          />
        )
      })}
    </div>
  )
}
