import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cloud, Info, AlertCircle, Leaf, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useMemo } from "react"
import type { ScopeBreakdown } from '@/lib/calculations/corporate-emissions';

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

interface CompanyFootprint {
  year: number;
  total_emissions: number;
  breakdown: ScopeBreakdown | null;
  status: 'Draft' | 'Finalized';
  last_updated: string | null;
  has_data: boolean;
}

interface GHGEmissionsSummaryWidgetProps {
  footprint?: CompanyFootprint | null;
  isLoading?: boolean;
  error?: string | null;
}

export function GHGEmissionsSummaryWidget({
  footprint,
  isLoading = false,
  error = null
}: GHGEmissionsSummaryWidgetProps = {}) {

  const formatEmissions = (value: number) => {
    return `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e`
  }

  const scopeData = useMemo(() => {
    if (!footprint?.breakdown) {
      return {
        scopeTotals: { 1: 0, 2: 0, 3: 0 },
        totalEmissions: 0,
        reportingPeriod: null,
      };
    }

    const scopeTotals = {
      1: (footprint.breakdown.scope1 || 0) / 1000,
      2: (footprint.breakdown.scope2 || 0) / 1000,
      3: (footprint.breakdown.scope3?.total || 0) / 1000,
    };

    const totalEmissions = footprint.total_emissions / 1000;
    const reportingPeriod = footprint.year.toString();

    return {
      scopeTotals,
      totalEmissions,
      reportingPeriod,
    };
  }, [footprint]);

  const { scopeTotals, totalEmissions, reportingPeriod } = scopeData;

  const getScopePercentage = (scopeTotal: number) => {
    if (totalEmissions === 0) return 0
    return (scopeTotal / totalEmissions) * 100
  }

  const getScopeDescription = (scope: number): string => {
    if (!footprint?.breakdown) {
      return scopeDescriptions[scope];
    }

    if (scope === 3 && footprint.breakdown.scope3) {
      const categories: string[] = [];
      if (footprint.breakdown.scope3.products > 0) categories.push('Products');
      if (footprint.breakdown.scope3.business_travel > 0) categories.push('Business Travel');
      if (footprint.breakdown.scope3.purchased_services > 0) categories.push('Services');
      if (footprint.breakdown.scope3.employee_commuting > 0) categories.push('Commuting');
      if (footprint.breakdown.scope3.capital_goods > 0) categories.push('Capital Goods');
      if (footprint.breakdown.scope3.logistics > 0) categories.push('Logistics');
      if (footprint.breakdown.scope3.waste > 0) categories.push('Waste');
      if (footprint.breakdown.scope3.marketing > 0) categories.push('Marketing');

      return categories.length > 0 ? categories.slice(0, 3).join(', ') : scopeDescriptions[scope];
    }

    return scopeDescriptions[scope];
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              GHG Emissions Summary
            </CardTitle>
            <CardDescription>
              Official company footprint
            </CardDescription>
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
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {([1, 2, 3] as const).map((scope) => {
              const scopeTotal = scopeTotals[scope]
              const percentage = getScopePercentage(scopeTotal)

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
                    {getScopeDescription(scope)}
                  </p>
                </div>
              )
            })}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Emissions</span>
                <span className="text-2xl font-bold">{formatEmissions(totalEmissions)}</span>
              </div>
              {totalEmissions === 0 ? (
                <div className="mt-3 flex flex-col items-center text-center py-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                    <Leaf className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-2">
                    Your GHG breakdown by Scope will appear here. Scope 1 &amp; 2 come from facilities, Scope 3 from products and suppliers.
                  </p>
                  <Button asChild size="sm" className="h-7 bg-neon-lime text-black hover:bg-neon-lime/90 text-xs">
                    <Link href="/company/facilities">
                      Get Started with Facilities <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>
                    {footprint?.status === 'Finalized' ? 'Finalized' : 'Draft'} • Last updated: {footprint?.last_updated ? new Date(footprint.last_updated).toLocaleDateString('en-GB') : 'Never'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
