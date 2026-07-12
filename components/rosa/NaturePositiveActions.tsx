'use client'

/**
 * "Your nature-positive actions": quiet typed fact rows on the brief
 * showing the org's regenerative / restoration / habitat work. Hidden
 * when none registered (no empty CTA rows).
 */

import { useEffect, useState } from 'react'
import { FactRow } from '@/components/studio/fact-row'
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
    <div>
      {actions.map(a => {
        const meta = getActionTypeMeta(a.action_type)
        const parts = [meta?.label ?? a.action_type]
        if (a.partner_name) parts.push(a.partner_name)
        if (a.location) parts.push(a.location)
        return (
          <FactRow
            key={a.id}
            href="/nature-actions/"
            subject={a.name}
            detail={parts.join(' · ')}
            meta={a.hectares > 0 ? `NATURE · ${formatHectares(a.hectares)} HA` : 'NATURE'}
          />
        )
      })}
    </div>
  )
}

function formatHectares(hectares: number): string {
  return Number.isInteger(hectares) ? String(hectares) : hectares.toFixed(1)
}
