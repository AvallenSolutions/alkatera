'use client'

/**
 * "Your nature-positive actions" — strip on the /rosa/ hub showing the
 * org's regenerative / restoration / habitat work. Hidden when none
 * registered (no empty CTA card).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sprout } from 'lucide-react'
import {
  getActionTypeMeta,
  type NatureActionType,
} from '@/lib/nature-actions/action-types'

interface ActiveAction {
  id: string
  name: string
  action_type: NatureActionType
  partner_name: string | null
  hectares: number
  location: string | null
  contract_started: string | null
}

export function NaturePositiveActions() {
  const [actions, setActions] = useState<ActiveAction[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/nature-actions?status=active', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled) return
        const items = Array.isArray(json?.actions) ? json.actions : []
        setActions(items.slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!actions || actions.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md p-1.5 border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
            <Sprout className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider">
            Your nature-positive actions
          </p>
        </div>
        <Link
          href="/nature-actions/"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2">
        {actions.map(a => {
          const meta = getActionTypeMeta(a.action_type)
          const since = a.contract_started ? new Date(a.contract_started).getFullYear() : null
          const parts = [meta?.label ?? a.action_type]
          if (a.partner_name) parts.push(a.partner_name)
          if (a.location) parts.push(a.location)
          if (since) parts.push(`since ${since}`)
          return (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span className="text-xl leading-none">{meta?.emoji ?? '🌿'}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground truncate">{parts.join(' · ')}</p>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {a.hectares.toFixed(1)} ha
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
