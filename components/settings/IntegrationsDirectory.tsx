'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Link2, Link2Off, Loader2, Mail, CheckCircle2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import {
  INTEGRATIONS,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  getIntegrationFeatureFlag,
  type IntegrationProvider,
  type IntegrationCategory,
} from '@/lib/integrations/directory'
import { XeroConnectionCard } from './XeroConnectionCard'
import { XeroSetupStepper } from './XeroSetupStepper'
import { BrewwConnectionCard } from './BrewwConnectionCard'

// Shape returned by /api/integrations/connections (generic, non-Xero providers).
interface ConnectionRow {
  id: string
  provider_slug: string
  status: 'active' | 'error' | 'disconnected'
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error' | null
  sync_error: string | null
  connected_at: string
  metadata: Record<string, unknown>
}

interface IntegrationsDirectoryProps {
  /** Compact variant used inside the onboarding wizard — hides the Xero setup stepper detail. */
  compact?: boolean
}

export function IntegrationsDirectory({ compact = false }: IntegrationsDirectoryProps) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const { hasFeature } = useSubscription()
  const [connections, setConnections] = useState<ConnectionRow[]>([])

  const refreshConnections = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/integrations/connections?organizationId=${orgId}`)
      if (!res.ok) return
      const body = await res.json()
      setConnections(body.data || [])
    } catch {
      /* non-fatal */
    }
  }, [orgId])

  useEffect(() => {
    refreshConnections()
  }, [refreshConnections])

  const byCategory = useMemo(() => {
    const out: Record<IntegrationCategory, IntegrationProvider[]> = {
      accounting: [], brewery_management: [], winery_management: [], inventory: [], hr: [], expenses: [], utilities: [],
    }
    for (const p of INTEGRATIONS) out[p.category].push(p)
    return out
  }, [])

  const connectionFor = (slug: string) => connections.find((c) => c.provider_slug === slug)

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((cat) => {
        const providers = byCategory[cat]
        if (!providers.length) return null
        return (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABEL[cat]}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <ProviderCard
                  key={p.slug}
                  provider={p}
                  connection={connectionFor(p.slug)}
                  hasFeature={hasFeature}
                  onRefreshConnections={refreshConnections}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Inline deep-configuration for live integrations that need extra UI beyond the card. */}
      {!compact && (
        <>
          <XeroSetupStepper />
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// ProviderCard — renders one row in the directory grid. Three kinds:
//  - Special-case Xero (still on xero_connections table) → delegate to its card
//  - Live providers on the generic table → render connection status + card
//  - "Coming soon" → render Request Access button
// ───────────────────────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  connection,
  hasFeature,
  onRefreshConnections,
}: {
  provider: IntegrationProvider
  connection?: ConnectionRow
  hasFeature: ReturnType<typeof useSubscription>['hasFeature']
  onRefreshConnections: () => void
}) {
  // Providers with an explicit featureFlag are actively in private beta.
  // Show the yellow "private beta — request access" note unless the org has
  // been granted access. Everything else falls through to a plain ComingSoonCard.
  const flag = getIntegrationFeatureFlag(provider)
  if (flag && !hasFeature(flag)) {
    return <ComingSoonCard provider={provider} note="In private beta — request access to enable." />
  }

  // Beta granted (or no flag at all): providers with bespoke connect cards
  // render those; the rest stay on ComingSoonCard until we build their
  // connect flow.
  if (provider.slug === 'xero') {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <XeroConnectionCard />
      </div>
    )
  }
  if (provider.slug === 'breww') {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <BrewwConnectionCard connection={connection} onChanged={onRefreshConnections} />
      </div>
    )
  }
  return <ComingSoonCard provider={provider} />
}

// ───────────────────────────────────────────────────────────────────────────────
// ComingSoonCard — a card with the provider name, description, and a Request
// Access button that fires /api/integrations/request. Logs demand signal.
// ───────────────────────────────────────────────────────────────────────────────

function ComingSoonCard({ provider, note }: { provider: IntegrationProvider; note?: string }) {
  const { currentOrganization } = useOrganization()
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)

  const handleRequest = async () => {
    if (!currentOrganization?.id) return
    setRequesting(true)
    try {
      const res = await fetch('/api/integrations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: currentOrganization.id, providerSlug: provider.slug }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not log request')
      }
      setRequested(true)
      toast.success(`Noted — we'll prioritise ${provider.name} based on demand.`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to log request')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{provider.name}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {provider.authType === 'oauth'
                ? 'OAuth'
                : provider.authType === 'api_key'
                  ? 'API key'
                  : 'Manual export'}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Coming soon</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3">{provider.description}</p>
        {note && <p className="text-[11px] text-amber-700 dark:text-amber-300">{note}</p>}
        <div className="flex flex-wrap gap-1 pt-1">
          {provider.provides.slice(0, 3).map((p) => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {p}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-2">
          {requested ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Request logged
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleRequest} disabled={requesting}>
              {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Request access
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
