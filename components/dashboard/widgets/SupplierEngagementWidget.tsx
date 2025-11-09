import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useSupplierEngagement } from "@/hooks/data/useSupplierEngagement"

const statusColors: Record<string, string> = {
  data_provided: '#10b981',
  active: '#3b82f6',
  invited: '#f59e0b',
  inactive: '#94a3b8',
  no_engagement: '#e2e8f0',
}

const statusLabels: Record<string, string> = {
  data_provided: 'Data Provided',
  active: 'Active',
  invited: 'Invited',
  inactive: 'Inactive',
  no_engagement: 'No Engagement',
}

function DonutChart({ data }: { data: { status: string; percentage: number; count: number }[] }) {
  let cumulativePercentage = 0

  const segments = data.map((item) => {
    const startPercentage = cumulativePercentage
    cumulativePercentage += item.percentage
    const endPercentage = cumulativePercentage

    const startAngle = (startPercentage / 100) * 360
    const endAngle = (endPercentage / 100) * 360

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

    const startX = 50 + 40 * Math.cos((Math.PI * startAngle) / 180 - Math.PI / 2)
    const startY = 50 + 40 * Math.sin((Math.PI * startAngle) / 180 - Math.PI / 2)
    const endX = 50 + 40 * Math.cos((Math.PI * endAngle) / 180 - Math.PI / 2)
    const endY = 50 + 40 * Math.sin((Math.PI * endAngle) / 180 - Math.PI / 2)

    const innerStartX = 50 + 25 * Math.cos((Math.PI * startAngle) / 180 - Math.PI / 2)
    const innerStartY = 50 + 25 * Math.sin((Math.PI * startAngle) / 180 - Math.PI / 2)
    const innerEndX = 50 + 25 * Math.cos((Math.PI * endAngle) / 180 - Math.PI / 2)
    const innerEndY = 50 + 25 * Math.sin((Math.PI * endAngle) / 180 - Math.PI / 2)

    const pathData = [
      `M ${startX} ${startY}`,
      `A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `L ${innerEndX} ${innerEndY}`,
      `A 25 25 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`,
      'Z',
    ].join(' ')

    return {
      path: pathData,
      color: statusColors[item.status] || statusColors.no_engagement,
      status: item.status,
      percentage: item.percentage,
      count: item.count,
    }
  })

  return (
    <div className="relative w-full aspect-square max-w-[200px] mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {segments.map((segment, index) => (
          <g key={index}>
            <path
              d={segment.path}
              fill={segment.color}
              className="transition-all duration-300 hover:opacity-80"
            />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-centre justify-centre">
        <p className="text-3xl font-bold">
          {data.reduce((sum, item) => sum + item.count, 0)}
        </p>
        <p className="text-xs text-muted-foreground">Suppliers</p>
      </div>
    </div>
  )
}

function SupplierEngagementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-centre">
        <Skeleton className="w-[200px] h-[200px] rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

export function SupplierEngagementWidget() {
  const { data: engagements, isLoading, error } = useSupplierEngagement()

  const prepareChartData = () => {
    if (!engagements || engagements.length === 0) {
      return []
    }

    return engagements.map((engagement) => ({
      status: engagement.status,
      percentage: engagement.percentage,
      count: engagement.supplier_count,
    }))
  }

  const chartData = prepareChartData()
  const totalSuppliers = engagements?.[0]?.total_suppliers || 0

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-centre gap-2">
          <Users className="h-5 w-5" />
          Supplier Engagement
        </CardTitle>
        <CardDescription>Supply chain engagement status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SupplierEngagementSkeleton />
        ) : error ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Data</h3>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          </div>
        ) : totalSuppliers === 0 ? (
          <div className="flex flex-col items-centre justify-centre py-12 px-4 text-centre">
            <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Suppliers</h3>
            <p className="text-sm text-muted-foreground">
              Add suppliers to track engagement and Scope 3 emissions
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <DonutChart data={chartData} />

            <div className="space-y-3">
              {chartData.map((item) => (
                <div key={item.status} className="flex items-centre justify-between">
                  <div className="flex items-centre gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: statusColors[item.status] }}
                    />
                    <span className="text-sm font-medium">
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <div className="flex items-centre gap-2">
                    <span className="text-sm font-bold">{item.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-centre justify-between text-sm">
                <span className="text-muted-foreground">Total Suppliers</span>
                <span className="font-semibold">{totalSuppliers}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
