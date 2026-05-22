'use client'

/**
 * "Your circular partnerships" — a quietly proud strip on the /rosa/ hub
 * surfacing 1-3 active byproducts with their named partners. Click-through
 * to /byproducts/ for the full gallery.
 *
 * Hidden when the org has no active byproducts (no empty state by design —
 * empty hub cards add noise; producers see this card only after they've
 * registered something to be proud of).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Recycle } from 'lucide-react'
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md p-1.5 border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
            <Recycle className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider">
            Your circular partnerships
          </p>
        </div>
        <Link
          href="/byproducts/"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2">
        {byproducts.map(bp => {
          const meta = getDestinationMeta(bp.destination_type)
          const since = bp.contract_started
            ? new Date(bp.contract_started).getFullYear()
            : null
          return (
            <li
              key={bp.id}
              className="flex items-center gap-3 text-sm"
            >
              <span className="text-xl leading-none">{meta?.emoji ?? '📦'}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{bp.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {bp.partner_name
                    ? `${meta?.label ?? bp.destination_type} · ${bp.partner_name}`
                    : meta?.label ?? bp.destination_type}
                  {since ? ` · since ${since}` : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
