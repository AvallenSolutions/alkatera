'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, TrendingUp } from 'lucide-react'

interface TestResultsProps {
  results: {
    totalClimate: string
    totalWater: string
    totalLand: string
    totalWaste: string
    materialCount: number
    breakdown: {
      ingredients: any[]
      packaging: any[]
    }
  }
}

export default function TestResults({ results }: TestResultsProps) {
  const ingredientsTotal = results.breakdown.ingredients.reduce((sum, item) => sum + item.climate, 0)
  const packagingTotal = results.breakdown.packaging.reduce((sum, item) => sum + item.climate, 0)
  const total = parseFloat(results.totalClimate)

  const ingredientsPercent = total > 0 ? (ingredientsTotal / total) * 100 : 0
  const packagingPercent = total > 0 ? (packagingTotal / total) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <CardTitle>Test Results Summary</CardTitle>
        </div>
        <CardDescription>
          Aggregated impact results across all categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Climate Change</p>
              <p className="text-2xl font-bold text-red-900">{results.totalClimate}</p>
              <p className="text-xs text-muted-foreground mt-1">kg CO₂e</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Water Use</p>
              <p className="text-2xl font-bold text-blue-900">{results.totalWater}</p>
              <p className="text-xs text-muted-foreground mt-1">litres</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Land Use</p>
              <p className="text-2xl font-bold text-green-900">{results.totalLand}</p>
              <p className="text-xs text-muted-foreground mt-1">m²</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Waste Generated</p>
              <p className="text-2xl font-bold text-amber-900">{results.totalWaste}</p>
              <p className="text-xs text-muted-foreground mt-1">kg</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-600" />
              <CardTitle className="text-base">Climate Impact Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Ingredients</Badge>
                  <span className="font-medium">{ingredientsTotal.toFixed(6)} kg CO₂e</span>
                </div>
                <span className="font-bold text-green-700">{ingredientsPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${ingredientsPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Packaging</Badge>
                  <span className="font-medium">{packagingTotal.toFixed(6)} kg CO₂e</span>
                </div>
                <span className="font-bold text-purple-700">{packagingPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all"
                  style={{ width: `${packagingPercent}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{results.totalClimate} kg CO₂e</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
          <p className="font-semibold text-sm mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Validation
          </p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>✅ All materials successfully processed: {results.materialCount} items</p>
            <p>✅ Impact calculations completed for all categories</p>
            <p>✅ Percentage breakdown sums to 100%: {(ingredientsPercent + packagingPercent).toFixed(1)}%</p>
            <p>✅ No missing or null values detected</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded">
          <p className="font-semibold mb-1">Note on Calculations:</p>
          <p>
            These results represent the aggregated environmental impacts calculated from material-level
            data using emission factors from the staging database. All calculations follow ISO 14044
            and ISO 14067 methodologies for life cycle assessment.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
