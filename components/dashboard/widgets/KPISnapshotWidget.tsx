import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign, Target, Activity } from "lucide-react"

export function KPISnapshotWidget() {
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-centre justify-between">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Emissions</p>
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-950 dark:text-blue-50">0 tCO₂e</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">No data available</p>
          </div>

          <div className="space-y-2 p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-centre justify-between">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Reduction Target</p>
              <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-950 dark:text-green-50">0%</p>
            <p className="text-xs text-green-700 dark:text-green-300">Set your goals</p>
          </div>

          <div className="space-y-2 p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-centre justify-between">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Carbon Cost</p>
              <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-950 dark:text-amber-50">£0</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">Estimated value</p>
          </div>

          <div className="space-y-2 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-centre justify-between">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Progress</p>
              <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-950 dark:text-purple-50">0%</p>
            <p className="text-xs text-purple-700 dark:text-purple-300">Towards target</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
