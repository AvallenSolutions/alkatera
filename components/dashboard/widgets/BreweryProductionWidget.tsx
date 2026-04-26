'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Beer, TrendingDown, TrendingUp, Minus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

interface MonthTotal {
  key: string
  label: string
  volume_hl: number
}

interface TopProduct {
  name: string
  volume_hl: number
  external_id: string
}

export function BreweryProductionWidget() {
  const { currentOrganization } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<MonthTotal[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [totalHl, setTotalHl] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [brewwConnected, setBrewwConnected] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  // Breww is a brewery management system — only relevant to beer/cider orgs.
  const isBreweryOrg = currentOrganization?.product_type === 'Beer & Cider'

  useEffect(() => {
    async function load() {
      if (!currentOrganization?.id || !isBreweryOrg) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)

        // Connection status (for empty-state CTA and freshness label)
        const { data: conn } = await supabase
          .from('integration_connections')
          .select('status, last_sync_at')
          .eq('organization_id', currentOrganization.id)
          .eq('provider_slug', 'breww')
          .maybeSingle()
        setBrewwConnected(conn?.status === 'active')
        setLastSyncAt(conn?.last_sync_at || null)

        const { data: runs } = await supabase
          .from('brewery_production_runs')
          .select('product_external_id, product_name, period_start, volume_hl')
          .eq('organization_id', currentOrganization.id)
          .order('period_start', { ascending: true })

        if (!runs || runs.length === 0) {
          setHasData(false)
          return
        }

        setHasData(true)

        const monthMap = new Map<string, number>()
        const productMap = new Map<string, TopProduct>()
        let sum = 0

        for (const r of runs) {
          const vol = Number(r.volume_hl || 0)
          sum += vol
          const d = new Date(r.period_start)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          monthMap.set(key, (monthMap.get(key) ?? 0) + vol)

          const existing = productMap.get(r.product_external_id)
          if (existing) {
            existing.volume_hl += vol
          } else {
            productMap.set(r.product_external_id, {
              external_id: r.product_external_id,
              name: r.product_name,
              volume_hl: vol,
            })
          }
        }

        const sortedMonths: MonthTotal[] = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, volume_hl]) => {
            const [y, m] = key.split('-')
            const d = new Date(Number(y), Number(m) - 1, 1)
            return {
              key,
              label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
              volume_hl,
            }
          })

        const sortedProducts = Array.from(productMap.values())
          .sort((a, b) => b.volume_hl - a.volume_hl)
          .slice(0, 5)

        setMonths(sortedMonths)
        setTopProducts(sortedProducts)
        setTotalHl(sum)
      } catch (err) {
        console.error('[BreweryProductionWidget]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentOrganization?.id, isBreweryOrg])

  // Hide widget entirely for non-brewery orgs (spirits, wine, etc.). Breww is a
  // brewery-only integration and should only surface on the dashboard for breweries.
  if (!isBreweryOrg) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Beer className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
            Brewery Production
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Connect CTA when org has no Breww connection yet.
  if (!hasData && !brewwConnected) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Beer className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
            Brewery Production
          </CardTitle>
          <CardDescription>Connect Breww to surface production volumes here</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" className="w-full">
            <Link href="/settings/integrations/breww">Connect Breww</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return null
  }

  const maxMonth = Math.max(...months.map((m) => m.volume_hl), 1)
  const firstHalf = months.slice(0, Math.floor(months.length / 2))
  const secondHalf = months.slice(Math.floor(months.length / 2))
  const firstAvg = firstHalf.reduce((s, m) => s + m.volume_hl, 0) / Math.max(firstHalf.length, 1)
  const secondAvg = secondHalf.reduce((s, m) => s + m.volume_hl, 0) / Math.max(secondHalf.length, 1)
  const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
  const TrendIcon = trendPct > 5 ? TrendingUp : trendPct < -5 ? TrendingDown : Minus

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Beer className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
              Brewery Production
            </CardTitle>
            <CardDescription>
              From Breww
              {lastSyncAt && (
                <span className="text-[10px] text-muted-foreground/70 ml-1">
                  · synced {new Date(lastSyncAt).toLocaleDateString('en-GB')}
                </span>
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trendPct).toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold tabular-nums">{totalHl.toFixed(1)} hL</div>
          <div className="text-xs text-muted-foreground">
            across {months.length} months, {topProducts.length} product{topProducts.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex items-end gap-1 h-14">
          {months.map((m) => {
            const h = Math.max((m.volume_hl / maxMonth) * 100, 4)
            return (
              <div key={m.key} className="flex-1 group relative">
                <div
                  className="w-full rounded-sm bg-[#ccff00]/30 hover:bg-[#ccff00]/60 transition-colors cursor-help"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-popover border text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-md">
                  {m.label}: {m.volume_hl.toFixed(1)} hL
                </div>
              </div>
            )
          })}
        </div>

        {topProducts.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Top products</div>
            {topProducts.map((p) => (
              <div key={p.external_id} className="flex items-center justify-between text-xs">
                <span className="truncate pr-2">{p.name}</span>
                <span className="tabular-nums text-muted-foreground">{p.volume_hl.toFixed(1)} hL</span>
              </div>
            ))}
          </div>
        )}

        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link href="/settings/integrations/breww">
            View synced data
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
