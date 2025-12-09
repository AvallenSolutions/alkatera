import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cloud, Info, AlertCircle, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useGhgHotspots } from "@/hooks/data/useGhgHotspots"
import Link from "next/link"

const scopeColors: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
}

const scopeLabels: Record<number, string> = {
  1: 'Operations: Direct Emissions',
  2: 'Operations: Purchased Energy',
  3: 'Supply Chain: Value Chain',
}

const scopeDescriptions: Record<number, string> = {
  1: 'Fuel combustion, company vehicles, fugitive emissions',
  2: 'Purchased electricity, heat, and cooling',
  3: 'Supplier activities, business travel, waste disposal',
}

function ScopeSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function GHGEmissionsSummaryWidget() {
  const { data: hotspots, isLoading, error } = useGhgHotspots()

  const formatEmissions = (value: number) => {
    return `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e`
  }

  const aggregateByScope = () => {
    if (!hotspots || hotspots.length === 0) {
      return {
        scopeTotals: { 1: 0, 2: 0, 3: 0 },
        totalEmissions: 0,
        reportingPeriod: null,
      }
    }

    const scopeTotals = hotspots.reduce((acc, hotspot) => {
      acc[hotspot.scope] = (acc[hotspot.scope] || 0) + hotspot.total_emissions
      return acc
    }, {} as Record<number, number>)

    const totalEmissions = Object.values(scopeTotals).reduce((sum, val) => sum + val, 0)
    const reportingPeriod = hotspots[0]?.reporting_period || null

    return {
      scopeTotals: {
        1: scopeTotals[1] || 0,
        2: scopeTotals[2] || 0,
        3: scopeTotals[3] || 0,
      },
      totalEmissions,
      reportingPeriod,
    }
  }

  const { scopeTotals, totalEmissions, reportingPeriod } = aggregateByScope()

  const getScopePercentage = (scopeTotal: number) => {
    if (totalEmissions === 0) return 0
    return (scopeTotal / totalEmissions) * 100
  }

  const getTopCategories = (scope: number) => {
    if (!hotspots) return []
    return hotspots
      .filter(h => h.scope === scope)
      .sort((a, b) => b.total_emissions - a.total_emissions)
      .slice(0, 3)
      .map(h => h.category_name)
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              GHG Emissions Summary
            </CardTitle>
            <CardDescription>Greenhouse gas emissions by scope</CardDescription>
          </div>
          {reportingPeriod && (
            <Badge variant="outline" className="h-fit">
              {reportingPeriod}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            <ScopeSkeleton />
            <ScopeSkeleton />
            <ScopeSkeleton />
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Emissions Data</h3>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {([1, 2, 3] as const).map((scope) => {
              const scopeTotal = scopeTotals[scope]
              const percentage = getScopePercentage(scopeTotal)
              const topCategories = getTopCategories(scope)

              return (
                <div key={scope} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${scopeColors[scope]}`} />
                      <span className="text-sm font-medium">{scopeLabels[scope]}</span>
                    </div>
                    <span className="text-sm font-bold">{formatEmissions(scopeTotal)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${scopeColors[scope]} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {topCategories.length > 0
                      ? topCategories.join(', ')
                      : scopeDescriptions[scope]}
                  </p>
                </div>
              )
            })}

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Emissions</span>
                <span className="text-2xl font-bold">{formatEmissions(totalEmissions)}</span>
              </div>
              {totalEmissions === 0 ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>Begin tracking emissions to see your organisation's carbon footprint</span>
                  </div>
                  <Button size="sm" asChild className="w-full">
                    <Link href="/data/scope-1-2">
                      Record Emissions
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>
                      {hotspots?.length || 0} emission {hotspots?.length === 1 ? 'category' : 'categories'} tracked
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/reports/company-footprint">
                      View Full Report
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
