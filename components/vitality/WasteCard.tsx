import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Recycle, TrendingDown, ArrowRight } from 'lucide-react';
import { CompanyMetrics } from '@/hooks/data/useCompanyMetrics';

interface WasteCardProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

export function WasteCard({ metrics, loading }: WasteCardProps) {
  if (loading) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
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

  const fossilScarcity = metrics?.total_impacts.fossil_resource_scarcity || 0;
  const circularityPercentage = metrics?.circularity_percentage || 0;

  const circularityLevel = circularityPercentage >= 70 ? 'high' : circularityPercentage >= 40 ? 'medium' : 'low';
  const circularityColor = circularityLevel === 'high' ? 'text-green-600' : circularityLevel === 'medium' ? 'text-amber-600' : 'text-red-600';
  const circularityBg = circularityLevel === 'high' ? 'bg-green-100' : circularityLevel === 'medium' ? 'bg-amber-100' : 'bg-red-100';

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100">
              <Recycle className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-lg">Circularity</CardTitle>
          </div>
          <Badge variant="default" className="bg-amber-600">
            E5
          </Badge>
        </div>
        <CardDescription>Resource use & circular economy (CSRD E5)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Circularity Score</span>
            <span className={`text-xs font-semibold ${circularityColor} uppercase tracking-wide`}>
              {circularityLevel === 'high' ? 'Good' : circularityLevel === 'medium' ? 'Moderate' : 'Needs Improvement'}
            </span>
          </div>

          <div className="relative">
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${circularityLevel === 'high' ? 'bg-green-600' : circularityLevel === 'medium' ? 'bg-amber-600' : 'bg-red-600'} transition-all`}
                style={{ width: `${circularityPercentage}%` }}
              />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-amber-900">
                {circularityPercentage}
              </span>
              <span className="text-lg text-muted-foreground">%</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Material circularity based on virgin resource use and recycled content
          </p>
        </div>

        <div className={`p-3 rounded-lg ${circularityBg} space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Fossil Resource Use
            </span>
            <TrendingDown className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-900">
              {fossilScarcity.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-sm text-muted-foreground">kg oil eq</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Virgin fossil resources consumed in product lifecycle
          </p>
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-amber-100/50 transition-colors text-sm font-medium text-amber-900">
          <span>View material flows</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
