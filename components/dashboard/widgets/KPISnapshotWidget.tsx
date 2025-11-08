import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Target, Activity, Loader2, AlertCircle } from "lucide-react"
import { useKpiSummary } from "@/hooks/data/useKpiSummary"
import { Skeleton } from "@/components/ui/skeleton"

const categoryIcons: Record<string, any> = {
  emissions: TrendingUp,
  financial: DollarSign,
  target: Target,
  progress: Activity,
  default: Activity,
}

const categoryColors: Record<string, string> = {
  emissions: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100",
  financial: "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100",
  target: "from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
  progress: "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100",
  default: "from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100",
}

const categoryIconColors: Record<string, string> = {
  emissions: "text-blue-600 dark:text-blue-400",
  financial: "text-green-600 dark:text-green-400",
  target: "text-amber-600 dark:text-amber-400",
  progress: "text-purple-600 dark:text-purple-400",
  default: "text-slate-600 dark:text-slate-400",
}

const categoryTextColors: Record<string, string> = {
  emissions: "text-blue-700 dark:text-blue-300",
  financial: "text-green-700 dark:text-green-300",
  target: "text-amber-700 dark:text-amber-300",
  progress: "text-purple-700 dark:text-purple-300",
  default: "text-slate-700 dark:text-slate-300",
}

const categoryValueColors: Record<string, string> = {
  emissions: "text-blue-950 dark:text-blue-50",
  financial: "text-green-950 dark:text-green-50",
  target: "text-amber-950 dark:text-amber-50",
  progress: "text-purple-950 dark:text-purple-50",
  default: "text-slate-950 dark:text-slate-50",
}

function KpiCardSkeleton() {
  return (
    <div className="space-y-2 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-centre justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function KPISnapshotWidget() {
  const { data: kpis, isLoading, error } = useKpiSummary()

  const formatValue = (value: number | null, unit: string) => {
    if (value === null || value === undefined) {
      return '—'
    }

    const numValue = Number(value)

    if (unit === '%') {
      return `${numValue.toFixed(1)}%`
    }

    if (unit === '£' || unit === 'GBP') {
      return `£${numValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
    }

    if (unit === 'tCO₂e' || unit === 'tCO2e') {
      return `${numValue.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e`
    }

    return `${numValue.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${unit}`
  }

  const getProgressText = (currentValue: number | null, targetValue: number | null) => {
    if (currentValue === null || currentValue === undefined) {
      return 'No data recorded'
    }

    if (targetValue === null || targetValue === undefined || targetValue === 0) {
      return 'No target set'
    }

    const progress = (currentValue / targetValue) * 100
    const isOnTrack = progress <= 100

    return isOnTrack
      ? `${progress.toFixed(0)}% of target`
      : `${progress.toFixed(0)}% (over target)`
  }

  const getIcon = (category: string | null) => {
    const IconComponent = categoryIcons[category || 'default'] || categoryIcons.default
    return IconComponent
  }

  const getColorClasses = (category: string | null) => {
    return categoryColors[category || 'default'] || categoryColors.default
  }

  const getIconColorClasses = (category: string | null) => {
    return categoryIconColors[category || 'default'] || categoryIconColors.default
  }

  const getTextColorClasses = (category: string | null) => {
    return categoryTextColors[category || 'default'] || categoryTextColors.default
  }

  const getValueColorClasses = (category: string | null) => {
    return categoryValueColors[category || 'default'] || categoryValueColors.default
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-centre gap-2">
          <Activity className="h-5 w-5" />
          KPI Snapshot
        </CardTitle>
        <CardDescription>Key performance indicators at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </div>
        ) : error ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load KPIs</h3>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          </div>
        ) : !kpis || kpis.length === 0 ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <Activity className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No KPIs Configured</h3>
            <p className="text-sm text-muted-foreground">
              Start tracking your performance by creating your first KPI
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = getIcon(kpi.category)
              const colorClasses = getColorClasses(kpi.category)
              const iconColorClasses = getIconColorClasses(kpi.category)
              const textColorClasses = getTextColorClasses(kpi.category)
              const valueColorClasses = getValueColorClasses(kpi.category)

              return (
                <div
                  key={kpi.kpi_id}
                  className={`space-y-2 p-4 bg-gradient-to-br rounded-lg border ${colorClasses}`}
                >
                  <div className="flex items-centre justify-between">
                    <p className={`text-sm font-medium ${colorClasses.split(' ').slice(-2).join(' ')}`}>
                      {kpi.name}
                    </p>
                    <Icon className={`h-4 w-4 ${iconColorClasses}`} />
                  </div>
                  <p className={`text-2xl font-bold ${valueColorClasses}`}>
                    {formatValue(kpi.current_value, kpi.unit)}
                  </p>
                  <p className={`text-xs ${textColorClasses}`}>
                    {getProgressText(kpi.current_value, kpi.target_value)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
