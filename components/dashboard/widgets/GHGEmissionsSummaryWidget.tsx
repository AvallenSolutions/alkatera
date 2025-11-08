import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cloud, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function GHGEmissionsSummaryWidget() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-centre justify-between">
          <div>
            <CardTitle className="flex items-centre gap-2">
              <Cloud className="h-5 w-5" />
              GHG Emissions Summary
            </CardTitle>
            <CardDescription>Greenhouse gas emissions by scope</CardDescription>
          </div>
          <Badge variant="outline" className="h-fit">
            Year to Date
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Scope 1: Direct Emissions</span>
              </div>
              <span className="text-sm font-bold">0 tCO₂e</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: '0%' }} />
            </div>
            <p className="text-xs text-muted-foreground">Fuel combustion, company vehicles, fugitive emissions</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-500" />
                <span className="text-sm font-medium">Scope 2: Indirect Emissions</span>
              </div>
              <span className="text-sm font-bold">0 tCO₂e</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: '0%' }} />
            </div>
            <p className="text-xs text-muted-foreground">Purchased electricity, heat, and cooling</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-centre justify-between">
              <div className="flex items-centre gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-sm font-medium">Scope 3: Value Chain Emissions</span>
              </div>
              <span className="text-sm font-bold">0 tCO₂e</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '0%' }} />
            </div>
            <p className="text-xs text-muted-foreground">Supply chain, business travel, waste disposal</p>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-centre justify-between">
              <span className="font-semibold">Total Emissions</span>
              <span className="text-2xl font-bold">0 tCO₂e</span>
            </div>
            <div className="mt-2 flex items-centre gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Begin tracking emissions to see your organisation's carbon footprint</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
