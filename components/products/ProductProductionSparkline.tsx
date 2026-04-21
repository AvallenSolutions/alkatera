'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Beer, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Month {
  period_start: string
  period_end: string
  volume_hl: number
  batches_count: number
}

export function ProductProductionSparkline({
  organizationId,
  productId,
}: {
  organizationId: string
  productId: number | string
}) {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(false)
  const [drinkName, setDrinkName] = useState<string | null>(null)
  const [months, setMonths] = useState<Month[]>([])
  const [totalHl, setTotalHl] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/integrations/breww/product-production?organizationId=${organizationId}&productId=${productId}`,
        )
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        setLinked(!!body.linked)
        setDrinkName(body.drink_name ?? null)
        setMonths(body.months ?? [])
        setTotalHl(Number(body.totalHl ?? 0))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [organizationId, productId])

  if (loading) {
    return (
      <Card className="border">
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!linked || months.length === 0) return null

  const maxVolume = Math.max(...months.map((m) => m.volume_hl), 1)
  const firstHalf = months.slice(0, Math.floor(months.length / 2))
  const secondHalf = months.slice(Math.floor(months.length / 2))
  const firstAvg = firstHalf.reduce((s, m) => s + m.volume_hl, 0) / Math.max(firstHalf.length, 1)
  const secondAvg = secondHalf.reduce((s, m) => s + m.volume_hl, 0) / Math.max(secondHalf.length, 1)
  const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
  const TrendIcon = trendPct > 5 ? TrendingUp : trendPct < -5 ? TrendingDown : Minus
  const trendColor = trendPct > 5 ? 'text-emerald-500' : trendPct < -5 ? 'text-amber-500' : 'text-muted-foreground'

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#ccff00]/20 flex items-center justify-center">
              <Beer className="h-4 w-4 text-[#8da300] dark:text-[#ccff00]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Brewery Production</h3>
              <p className="text-xs text-muted-foreground">
                {drinkName ? `${drinkName} · ` : ''}Last {months.length} months from Breww
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums text-foreground">{totalHl.toFixed(1)} hL</div>
            <div className={`text-[11px] flex items-center justify-end gap-0.5 ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trendPct).toFixed(0)}% vs first half
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1 h-16">
          {months.map((m) => {
            const h = Math.max((m.volume_hl / maxVolume) * 100, 4)
            const label = new Date(m.period_start).toLocaleDateString('en-GB', {
              month: 'short',
              year: '2-digit',
            })
            return (
              <div key={m.period_start} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-sm bg-[#ccff00]/30 hover:bg-[#ccff00]/60 transition-colors cursor-help"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute bottom-full mb-1 px-2 py-1 rounded bg-popover border text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-md">
                  {label}: {m.volume_hl.toFixed(1)} hL · {m.batches_count} batch{m.batches_count === 1 ? '' : 'es'}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>
            {months.length > 0
              ? new Date(months[0].period_start).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
              : ''}
          </span>
          <span>
            {months.length > 0
              ? new Date(months[months.length - 1].period_start).toLocaleDateString('en-GB', {
                  month: 'short',
                  year: '2-digit',
                })
              : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
