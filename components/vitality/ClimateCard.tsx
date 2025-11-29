import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Leaf, TrendingUp, ArrowRight } from 'lucide-react';
import { CompanyMetrics } from '@/hooks/data/useCompanyMetrics';

interface ClimateCardProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
  onViewBreakdown?: () => void;
}

export function ClimateCard({ metrics, loading, onViewBreakdown }: ClimateCardProps) {
  if (loading) {
    return (
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const totalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;
  const topContributor = metrics?.climate_top_contributor;
  const csrdCompliant = (metrics?.csrd_compliant_percentage || 0) > 90;

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-100">
              <Leaf className="h-5 w-5 text-orange-600" />
            </div>
            <CardTitle className="text-lg">Climate Impact</CardTitle>
          </div>
          {csrdCompliant && (
            <Badge variant="default" className="bg-green-600">
              CSRD
            </Badge>
          )}
        </div>
        <CardDescription>Total greenhouse gas emissions (CSRD E1)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-orange-900">
              {totalCO2.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </span>
            <span className="text-lg text-muted-foreground">kg CO₂eq</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Across {metrics?.total_products_assessed || 0} products assessed
          </p>
        </div>

        {topContributor && (
          <div className="p-3 rounded-lg bg-orange-100/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-900 uppercase tracking-wide">
                Top Contributor
              </span>
              <Badge variant="outline" className="text-xs">
                {topContributor.percentage.toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-sm text-orange-900">
                  {topContributor.name}
                </span>
              </div>
              <span className="text-sm font-medium text-orange-700">
                {topContributor.value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {topContributor.category}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Carbon breakdown button clicked', { onViewBreakdown: !!onViewBreakdown });
            if (onViewBreakdown) {
              console.log('Calling onViewBreakdown');
              onViewBreakdown();
            } else {
              console.log('onViewBreakdown is not defined');
            }
          }}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-orange-100/50 transition-colors text-sm font-medium text-orange-900"
        >
          <span>View carbon breakdown</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
